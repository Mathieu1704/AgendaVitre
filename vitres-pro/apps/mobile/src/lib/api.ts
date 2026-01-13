import axios from "axios";
import { supabase } from "./supabase";

// Pour le WEB, localhost marche.
// Pour ANDROID Emulator, il faudra peut-être utiliser 'http://10.0.2.2:8000' plus tard.
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercepteur : Ajoute le token Supabase avant chaque envoi
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();

  if (data.session?.access_token) {
    config.headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);
