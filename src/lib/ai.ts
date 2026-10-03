/**
 * AI configuration — Vercel AI SDK with an OpenAI-compatible provider.
 *
 * Any OpenAI-compatible endpoint works: OpenAI proper, OpenRouter, Groq,
 * Together, a local Ollama, etc. Set OPENAI_API_KEY + (optionally)
 * OPENAI_BASE_URL and OPENAI_MODEL in .env.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/lib/env";

let _provider: ReturnType<typeof createOpenAI> | undefined;

export function openaiProvider() {
  if (!_provider) {
    _provider = createOpenAI({
      apiKey: env.openaiApiKey,
      // Empty-string env vars would be passed through and rejected by the
      // provider — normalize to undefined so the default endpoint is used.
      baseURL: env.openaiBaseUrl || undefined,
    });
  }
  return _provider;
}

/** The chat model used for structured generation tasks. */
export function chatModel() {
  return openaiProvider()(env.openaiModel);
}

/** The model used for text embeddings (Elastic semantic search). */
export function embeddingModel() {
  return openaiProvider().embedding("text-embedding-3-small");
}
