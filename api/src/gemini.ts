import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { Recipe } from "./schema.js";

const PROMPT = `You are reading a cooking video (or its caption) and writing the recipe down.
Return ONLY the JSON object described by the schema.
Rules:
- source "stated": the amount or number is said, shown on screen, or written in the caption.
- source "estimated": you are guessing. Use this whenever you are not sure.
- qty is a number (use decimals, e.g. 0.5) or null if the amount is not given and cannot be guessed.
- macros_per_serving is per ONE serving. Use "stated" only if the creator gives the numbers.
- creator is the channel or handle if visible, else "Unknown".
- cuisine is one or two words, e.g. "Korean", "Italian", "Mexican", "Home-style".
- confidence 0..1: how sure you are that this is the actual recipe.
- If this is not a cooking video, set confidence to 0 and fill fields with your best attempt.`;

const jsonSchema = (() => {
  const { $schema, ...rest } = z.toJSONSchema(Recipe) as Record<string, unknown>;
  return rest;
})();

let client: GoogleGenAI | null = null;
const ai = () => {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  return (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
};

export async function readRecipe(input: { youtubeUrl?: string; caption?: string }): Promise<Recipe> {
  const parts: Array<Record<string, unknown>> = [];
  if (input.youtubeUrl) parts.push({ fileData: { fileUri: input.youtubeUrl } });
  if (input.caption) parts.push({ text: `Caption / description text:\n${input.caption}` });
  parts.push({ text: PROMPT });

  const res = await ai().models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-flash-latest",
    contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json", responseJsonSchema: jsonSchema, temperature: 0.2 },
  });
  const text = res.text;
  if (!text) throw new Error("Gemini returned an empty answer");
  return Recipe.parse(JSON.parse(text));
}
