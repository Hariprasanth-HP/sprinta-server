import { GoogleGenAI } from "@google/genai";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import type { Request, Response } from "express";
import { getJSON, setJSON } from "../lib/redis";

dotenv.config();

const ai = new GoogleGenAI({});
const GENERATE_TTL = 300;

export const generateResults = async (req: Request, res: Response) => {
  const prompt = req.body.prompt || "Hello!";
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const fullPrompt = `${prompt} limit the result in 20 words`;
  const cacheKey = `generate:${createHash("sha256").update(fullPrompt).digest("hex")}`;

  const cached = await getJSON<{ text: unknown }>(cacheKey);
  if (cached) {
    return res.json({ data: { ok: true, model, text: cached.text }, success: true });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
    });

    let textResult = response?.text;
    if (!textResult && response?.candidates?.length) {
      const firstCandidate = response.candidates[0];
      if (firstCandidate?.content?.parts?.length) {
        textResult = firstCandidate.content.parts.map((p) => p.text).join("");
      }
    }

    const result = { text: textResult ?? response };
    await setJSON(cacheKey, result, GENERATE_TTL);

    return res.json({
      data: { ok: true, model, text: textResult ?? response },
      success: true,
    });
  } catch (error: any) {
    console.error("Gemini error:", error);
    const message = error?.message || String(error) || "Unknown error from Gemini";
    return res.status(500).json({ ok: false, error: message });
  }
};
