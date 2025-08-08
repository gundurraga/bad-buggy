import { AIProviderResponse } from "../types";
export declare const callWithRetry: <T>(apiCall: () => Promise<T>, retries?: number) => Promise<T>;
export declare const callAnthropic: (prompt: string, model: string) => Promise<AIProviderResponse>;
export declare const callOpenRouter: (prompt: string, model: string) => Promise<AIProviderResponse>;
export declare const callAIProvider: (provider: "anthropic" | "openrouter", prompt: string, model: string) => Promise<AIProviderResponse>;
//# sourceMappingURL=ai-api.d.ts.map