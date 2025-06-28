import * as Y from 'yjs'
import WebSocket from 'ws'
import http from 'http'
import {parseCookies, setContentInitializor, setupWSConnection} from './utils'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import {getDocInfo} from "./api/getDocInfo";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET
// noServer를 통해 upgrade를 과정으로 수동으로 처리
const wss = new WebSocket.Server({ noServer: true })
const host = 'localhost'
const port = 3002

const server = http.createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('okay')
})

// 문서 초기 정보 init
setContentInitializor(async (doc: Y.Doc, docId: string) => {
  // docId로 API 호출
  const res = await getDocInfo(docId)
  const ydoc = res?.data?.ydoc
  if (!ydoc) return;

  // 디코딩 후 doc에 적용
  const update = Uint8Array.from(atob(ydoc), char => char.charCodeAt(0));
  Y.applyUpdate(doc, update)
})

// connection 세팅
wss.on('connection', setupWSConnection)

server.on('upgrade', (request, socket, head) => {
  const cookieHeader = request.headers.cookie
  const cookies = parseCookies(cookieHeader || '')
  const token = cookies['ACCESS_TOKEN']

  if (!token) {
    // 토큰이 없으면 401 응답 후 연결 거절
    socket.write('401 Unauthorized')
    socket.destroy()
    return
  }

  // JWT 토큰 검증
  try {
    jwt.verify(token, JWT_SECRET ?? "")
  } catch (err) {
    console.warn('JWT 검증 실패:', err);
    socket.write('401 Unauthorized')
    socket.destroy()
    return;
  }

  wss.handleUpgrade(request, socket, head, ws => {
    wss.emit('connection', ws, request)
  })
})

server.listen(port, host, () => {
  console.log(`running at '${host}' on port ${port}`)
})
