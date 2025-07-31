import { AIProviderResponse } from "../types";
export declare const callAnthropic: (prompt: string, apiKey: string, model: string) => Promise<AIProviderResponse>;
export declare const callOpenRouter: (prompt: string, apiKey: string, model: string) => Promise<AIProviderResponse>;
export declare const callAIProvider: (provider: "anthropic" | "openrouter", prompt: string, apiKey: string, model: string) => Promise<AIProviderResponse>;
//# sourceMappingURL=ai-api.d.ts.map