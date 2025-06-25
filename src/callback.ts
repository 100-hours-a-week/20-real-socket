import http from 'http'
import { WSSharedDoc } from './utils'

// 환경 변수에서 콜백 URL 파싱
const CALLBACK_URL = new URL(process.env.CALLBACK_URL ?? "localhost:8080")

// 콜백 타임아웃 (기본값: 5000ms)
const CALLBACK_TIMEOUT = 5000

// 콜백에 사용할 객체 목록(JSON 형식)
const CALLBACK_OBJECTS: Record<string, string> = process.env.CALLBACK_OBJECTS
  ? JSON.parse(process.env.CALLBACK_OBJECTS)
  : {}

export const isCallbackSet = !!CALLBACK_URL

// 콜백 핸들러: 문서 변경 시 콜백 요청을 보냄
export const callbackHandler = (doc: WSSharedDoc): void => {
  const room = doc.name
  const dataToSend: {
    room: string
    data: Record<string, { type: string; content: any }>
  } = {
    room,
    data: {},
  }

  const sharedObjectList = Object.keys(CALLBACK_OBJECTS)
  sharedObjectList.forEach((sharedObjectName) => {
    const sharedObjectType = CALLBACK_OBJECTS[sharedObjectName]
    const content = getContent(sharedObjectName, sharedObjectType, doc)
    dataToSend.data[sharedObjectName] = {
      type: sharedObjectType,
      content: content.toJSON(),
    }
  })

  if (CALLBACK_URL) {
    callbackRequest(CALLBACK_URL, CALLBACK_TIMEOUT, dataToSend)
  }
}

// 콜백 요청을 HTTP POST로 전송하는 함수
const callbackRequest = (url: URL, timeout: number, data: any): void => {
  const jsonData = JSON.stringify(data)

  const options: http.RequestOptions = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    timeout,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(jsonData),
    },
  }

  // const req = http.request(options)

  // req.on('timeout', () => {
  //   console.warn('Callback request timed out.')
  //   req.destroy()
  // })
  //
  // req.on('error', (e) => {
  //   console.error('Callback request error.', e)
  //   req.destroy()
  // })
  //
  // req.write(jsonData)
  // req.end()
}

// 공유 객체의 이름과 타입에 따라 해당 객체를 가져오는 함수
const getContent = (objName: string, objType: string, doc: WSSharedDoc): any => {
  switch (objType) {
    case 'Array':
      return doc.getArray(objName)
    case 'Map':
      return doc.getMap(objName)
    case 'Text':
      return doc.getText(objName)
    case 'XmlFragment':
      return doc.getXmlFragment(objName)
    case 'XmlElement':
      return doc.getXmlElement(objName)
    default:
      return {}
  }
}