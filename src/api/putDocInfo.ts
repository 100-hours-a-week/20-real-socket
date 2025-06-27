import {apiClient} from "./apiClient";
import {BaseResponse} from "../entity/baseResponse";

export interface putWikiRequest {
  id: number;
  html: string;
  ydoc: string;
}

export const putWiki = async ({ id, html, ydoc }: putWikiRequest) => {
  try {
    const res: BaseResponse<void> =  await apiClient.put(`/v2/wikis/${id}`, {
      html, ydoc
    });

    return res.code;
  } catch (error) {
    console.error(error)
  }
};