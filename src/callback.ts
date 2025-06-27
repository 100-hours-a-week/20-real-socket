import {WSSharedDoc} from './utils'
import {putWiki} from "./api/putDocInfo";
import {parseInt} from "lib0/number";
import * as Y from 'yjs'

// 콜백 핸들러: 문서 변경 시 콜백 요청을 보냄
export const callbackHandler = (doc: WSSharedDoc, docId: string, userIds: number[]): void => {
  const fragment = doc.getXmlFragment('default')
  const html = fragment.toString()
  const update = btoa(String.fromCharCode(...Y.encodeStateAsUpdate(doc)))

  putWiki({id: parseInt(docId), html, ydoc: update })
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