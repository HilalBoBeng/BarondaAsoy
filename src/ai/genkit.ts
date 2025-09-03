import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";

// 🔑 Hardcode API key agar tidak perlu ENV di Vercel
const GEMINI_API_KEY = "AIzaSyDKXjv-517Vs3FqP4MrAM83Itn3KZYxJ3E";

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GEMINI_API_KEY, // ✅ langsung pakai key ini
    }),
  ],
  model: "googleai/gemini-2.0-flash",
});
