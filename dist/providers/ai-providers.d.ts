export declare class AIProviderError extends Error {
    readonly provider: string;
    readonly status?: number;
    constructor(message: string, provider: string, status?: number);
}
export declare function callAIProvider(provider: string, prompt: string, model: string, apiKey: string): Promise<string>;
//# sourceMappingURL=ai-providers.d.ts.map