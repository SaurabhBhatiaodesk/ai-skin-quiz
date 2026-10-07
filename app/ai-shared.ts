export type AIProvider = "openai" | "gemini" | "claude";
export const PROVIDER_NAMES = { openai: "OpenAI", gemini: "Gemini", claude: "Claude" };
export function asProvider(value: unknown): AIProvider {
  if (value === "gemini" || value === "claude" || value === "openai") return value;
  throw new Error("Choose OpenAI, Gemini or Claude.");
}
