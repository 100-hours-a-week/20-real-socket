import axios from 'axios'
import dotenv from "dotenv"

dotenv.config()

export const apiClient = axios.create({
  baseURL: process.env.BACKEND_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
})