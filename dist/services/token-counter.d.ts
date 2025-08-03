export interface TokenCountResult {
    tokens: number;
    provider: string;
    model: string;
}
export interface TokenCounter {
    countTokens(text: string, model: string): Promise<TokenCountResult>;
}
export declare class AnthropicTokenCounter implements TokenCounter {
    private apiKey;
    constructor(apiKey: string);
    countTokens(text: string, model: string): Promise<TokenCountResult>;
}
export declare class OpenRouterTokenCounter implements TokenCounter {
    private apiKey;
    constructor(apiKey: string);
    countTokens(text: string, model: string): Promise<TokenCountResult>;
}
export declare class TokenCounterFactory {
    static create(provider: 'anthropic' | 'openrouter', apiKey: string): TokenCounter;
}
//# sourceMappingURL=token-counter.d.ts.map