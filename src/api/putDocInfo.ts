import {apiClient} from "./apiClient";
import {BaseResponse} from "../entity/baseResponse";

export interface putWikiRequest {
  id: number;
  html: string;
  ydoc: string;
  editorsId: number[];
}

export const putWiki = async ({id, html, ydoc, editorsId}: putWikiRequest) => {
  try {
    const res: BaseResponse<void> = await apiClient.put(`/v2/auth/wikis/${id}`, {
      html,
      ydoc,
      editorsId,
      apiKey: process.env.API_KEY
    });
    return res.code;
  } catch (error) {
    console.error(error)
  }
};