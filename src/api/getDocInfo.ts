import {apiClient} from "./apiClient";
import {BaseResponse} from "../entity/baseResponse";

interface getDocInfoResponse {
  id: number;
  title: string;
  ydoc?: string;
  html?: string;
  updatedAt: string;
}

// DB에서 문서 정보를 가져오기
export const getDocInfo = async (docId: string): Promise<BaseResponse<getDocInfoResponse> | undefined>  => {
  try {
    return await apiClient.get(`/v2/wikis/${docId}`)
  } catch (err) {
    console.log(err)
  }

}