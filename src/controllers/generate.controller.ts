// backend/src/controllers/taskStatusController.js
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { Request, Response } from "express";
dotenv.config();

// Init Gemini client (the SDK reads GEMINI_API_KEY from env by default)
const ai = new GoogleGenAI({});

/**
 * CREATE TaskStatus
 * Body: { prompt }
 */
export const generateResults = async (req: Request, res: Response) => {
  const prompt = req.body.prompt || "Hello!";
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  try {
    // The SDK exposes models.generateContent
    const response = await ai.models.generateContent({
      model,
      // contents can be a string or an array. Keep it simple here.
      contents: `${prompt} limit the result in 20 words`,
    });

    // The shape of the response can vary; prefer response.text when available.
    // Fallback to candidates content parts if needed.
    let textResult = response?.text;
    if (!textResult && response?.candidates?.length) {
      // candidates -> content -> parts -> [ { text: "..." } ]
      const firstCandidate = response.candidates[0];
      if (firstCandidate?.content?.parts?.length) {
        textResult = firstCandidate.content.parts.map((p) => p.text).join("");
      }
    }

    // Return a clean JSON payload
    return res.json({
      data: { ok: true, model, text: textResult ?? response },
      success: true,
    });
  } catch (error: any) {
    console.error("Gemini error:", error);
    // best-effort readable message
    const message = error?.message || String(error) || "Unknown error from Gemini";
    return res.status(500).json({ ok: false, error: message });
  }
};
