import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'

import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as map from 'lib0/map'
import * as eventloop from 'lib0/eventloop'

import { callbackHandler } from './callback'
import { IncomingMessage } from 'http'
import { WebSocket } from 'ws'

// 마지막 입력 후 2초 후 요청
const CALLBACK_DEBOUNCE_WAIT = 2000
// 계속 입력을 하더라도 10초가 지나면 요청
const CALLBACK_DEBOUNCE_MAXWAIT = 10000

const debouncer = eventloop.createDebouncer(CALLBACK_DEBOUNCE_WAIT, CALLBACK_DEBOUNCE_MAXWAIT)

const wsReadyStateConnecting = 0
const wsReadyStateOpen = 1

export const docs = new Map<string, WSSharedDoc>()

// 싱크 관련 메시지
const messageSync = 0
// 커서 관련 메시지
const messageAwareness = 1

// 문서 업데이트가 발생했을 때 연결된 클라이언트에게 브로드캐스트
const updateHandler = (update: Uint8Array, _origin: any, doc: WSSharedDoc, _tr: any) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeUpdate(encoder, update)
  const message = encoding.toUint8Array(encoder)

  // 이 문서와 연결된 모든 클라이언트에게 메시지를 전송
  doc.conns.forEach((_, conn) => send(doc, conn, message))
}

// 문서 초기 로드 initializor
let contentInitializor: (ydoc: Y.Doc, docId: string) => Promise<void> = () => Promise.resolve()

export const setContentInitializor = (f: typeof contentInitializor) => {
  contentInitializor = f
}

// Yjs 문서를 확장하여 WebSocket 연결 및 Awareness 상태 관리
export class WSSharedDoc extends Y.Doc {
  name: string
  conns: Map<any, Set<number>>
  awareness: awarenessProtocol.Awareness
  whenInitialized: Promise<void>

  constructor(name: string) {
    super({ gc: true })
    this.name = name
    this.conns = new Map()
    this.awareness = new awarenessProtocol.Awareness(this)
    this.awareness.setLocalState(null)

    // 커서 변경 핸들러
    const awarenessChangeHandler = ({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }, conn: any) => {
      const changedClients = added.concat(updated, removed)
      if (conn !== null) {
        const connControlledIDs = this.conns.get(conn)
        if (connControlledIDs !== undefined) {
          added.forEach(clientID => connControlledIDs.add(clientID))
          removed.forEach(clientID => connControlledIDs.delete(clientID))
        }
      }
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients))
      const buff = encoding.toUint8Array(encoder)
      // 모든 클라이언트에게 broadcast
      this.conns.forEach((_, c) => send(this, c, buff))
    }

    this.awareness.on('update', awarenessChangeHandler)
    this.on('update', updateHandler as any)

    // 문서 업데이트 시 debounce 후 콜백 호출
    this.on('update', (_update, _origin, doc) => {
      const userIds = Array.from(this.awareness.getStates().values())
        .map(state => state.user?.id)
        .filter((id): id is number => typeof id === 'number')
      debouncer(() => callbackHandler(doc as WSSharedDoc, name, userIds))
    })

    this.whenInitialized = contentInitializor(this, name)
  }
}

// 문서를 가져오거나 새로 생성
export const getYDoc = (docname: string, gc = true): WSSharedDoc => {
  return map.setIfUndefined(docs, docname, () => {
    const doc = new WSSharedDoc(docname)
    doc.gc = gc
    docs.set(docname, doc)
    return doc
  })
}

// 메시지를 받는 경우 핸들러
const messageListener = (conn: any, doc: WSSharedDoc, message: Uint8Array) => {
  try {
    const encoder = encoding.createEncoder()
    const decoder = decoding.createDecoder(message)
    const messageType = decoding.readVarUint(decoder)
    switch (messageType) {
      // 싱크 메시지
      case messageSync:
        encoding.writeVarUint(encoder, messageSync)
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn)
        if (encoding.length(encoder) > 1) {
          send(doc, conn, encoding.toUint8Array(encoder))
        }
        break
      // 커서 메시지
      case messageAwareness:
        awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn)
        break
    }
  } catch (err) {
    console.error(err)
    // @ts-ignore
    doc.emit('error', [err])
  }
}

const closeConn = (doc: WSSharedDoc, conn: any) => {
  if (doc.conns.has(conn)) {
    const controlledIds = doc.conns.get(conn) as Set<number>
    doc.conns.delete(conn)
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null)
    if (doc.conns.size === 0) {
      doc.destroy()
      docs.delete(doc.name)
    }
  }
  conn.close()
}

const send = (doc: WSSharedDoc, conn: WebSocket, m: Uint8Array) => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    closeConn(doc, conn)
  }
  try {
    conn.send(m, {}, err => { if (err != null) closeConn(doc, conn) })
  } catch (e) {
    closeConn(doc, conn)
  }
}

const pingTimeout = 30000

// WebSocket 연결 설정 및 동기화 메시지 처리
export const setupWSConnection = (
  conn: WebSocket,
  req: IncomingMessage,
  { docName = (req.url || '').slice(1).split('?')[0], gc = true }: { docName?: string; gc?: boolean } = {}
) => {
  conn.binaryType = 'arraybuffer'
  const doc = getYDoc(docName, gc)
  doc.conns.set(conn, new Set())
  conn.on('message', message => messageListener(conn, doc, new Uint8Array(message as ArrayBuffer)))

  let pongReceived = true
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) closeConn(doc, conn)
      clearInterval(pingInterval)
    } else if (doc.conns.has(conn)) {
      pongReceived = false
      try {
        conn.ping()
      } catch (e) {
        closeConn(doc, conn)
        clearInterval(pingInterval)
      }
    }
  }, pingTimeout)

  conn.on('close', () => {
    closeConn(doc, conn)
    clearInterval(pingInterval)
  })
  conn.on('pong', () => { pongReceived = true })

  {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeSyncStep1(encoder, doc)
    send(doc, conn, encoding.toUint8Array(encoder))

    const awarenessStates = doc.awareness.getStates()
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())))
      send(doc, conn, encoding.toUint8Array(encoder))
    }
  }
}

// 쿠키를 디코딩
export const parseCookies = (cookieHeader: string): Record<string, string> => {
  return Object.fromEntries(
    cookieHeader
      ?.split('; ')
      .map((cookie) => cookie.split('=').map(decodeURIComponent))
      .filter((pair): pair is [string, string] => pair.length === 2) ?? []
  );
}