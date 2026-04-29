export async function GET() {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}&pageSize=50`
  );
  const data = await res.json();
  const embedModels = (data.models ?? []).filter((m: { supportedGenerationMethods?: string[] }) =>
    m.supportedGenerationMethods?.includes("embedContent")
  );
  return Response.json(embedModels.map((m: { name: string }) => m.name));
}
