import "dotenv/config";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const res = await openai.responses.create({
  model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  input: "Trả lời ngắn gọn: EMOORI là gì?",
});

console.log(res.output_text);