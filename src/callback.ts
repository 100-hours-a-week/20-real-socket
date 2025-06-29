import {WSSharedDoc} from './utils'
import {putWiki} from "./api/putDocInfo";
import {parseInt} from "lib0/number";
import * as Y from 'yjs'

// 콜백 핸들러: 문서 변경 시 콜백 요청을 보냄
export const callbackHandler = (doc: WSSharedDoc, docId: string, userIds: number[]): void => {
  const fragment = doc.getXmlFragment('default')
  const html = fragment.toString()
  const update = btoa(String.fromCharCode(...Y.encodeStateAsUpdate(doc)))

  putWiki({id: parseInt(docId), html, ydoc: update, editorsId: userIds })
}