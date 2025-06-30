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
    const res =  await apiClient.post(`/v1/auth/wikis/${docId}`, {
      apiKey: process.env.API_KEY
    })
    return res.data
  } catch (err) {
    console.error(err)
  }

}