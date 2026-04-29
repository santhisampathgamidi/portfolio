import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel(
  { model: "models/gemini-embedding-001" },
  { apiVersion: "v1beta" }
);

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const results = await model.batchEmbedContents({
    requests: texts.map((text) => ({
      content: { role: "user", parts: [{ text }] },
    })),
  });
  return results.embeddings.map((e) => e.values);
}

export async function embedQuery(text: string): Promise<number[]> {
  const result = await model.embedContent(text);
  return result.embedding.values;
}
