import WebSocket from 'ws'
import http from 'http'
import {parseCookies, setupWSConnection} from './utils'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET
const wss = new WebSocket.Server({ noServer: true })
const host = 'localhost'
const port = 3002

const server = http.createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('okay')
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

  wss.handleUpgrade(request, socket, head, /** @param {any} ws */ ws => {
    wss.emit('connection', ws, request)
  })
})

server.listen(port, host, () => {
  console.log(`running at '${host}' on port ${port}`)
})
