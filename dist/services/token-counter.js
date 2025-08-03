"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenCounterFactory = exports.OpenRouterTokenCounter = exports.AnthropicTokenCounter = void 0;
const types_1 = require("../types");
const credential_manager_1 = require("../security/credential-manager");
// Anthropic Token Counter using their Token Counting API
class AnthropicTokenCounter {
    constructor() {
        this.credentialManager = credential_manager_1.CredentialManager.getInstance();
    }
    async countTokens(text, model) {
        const apiKey = this.credentialManager.getApiKey('anthropic');
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: text }],
                }),
            });
            if (!response.ok) {
                throw new types_1.AIProviderError(`Anthropic token counting API error: ${response.statusText}`, response.status);
            }
            const data = await response.json();
            return {
                tokens: data.input_tokens,
                provider: 'anthropic',
                model: model,
            };
        }
        catch (error) {
            if (error instanceof types_1.AIProviderError) {
                throw error;
            }
            throw new types_1.AIProviderError(`Failed to count tokens with Anthropic: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.AnthropicTokenCounter = AnthropicTokenCounter;
// OpenRouter Token Counter using minimal completion requests
class OpenRouterTokenCounter {
    constructor() {
        this.credentialManager = credential_manager_1.CredentialManager.getInstance();
    }
    async countTokens(text, model) {
        const apiKey = this.credentialManager.getApiKey('openrouter');
        try {
            // Use a minimal completion request to get token count
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://github.com/gundurraga/bad-buggy',
                    'X-Title': 'Bad Buggy Code Reviewer',
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: text }],
                    max_tokens: 1, // Minimal completion to get token count
                    usage: {
                        include: true, // Enable usage accounting
                    },
                }),
            });
            if (!response.ok) {
                throw new types_1.AIProviderError(`OpenRouter token counting API error: ${response.statusText}`, response.status);
            }
            const data = await response.json();
            return {
                tokens: data.usage?.prompt_tokens || 0,
                provider: 'openrouter',
                model: model,
            };
        }
        catch (error) {
            if (error instanceof types_1.AIProviderError) {
                throw error;
            }
            throw new types_1.AIProviderError(`Failed to count tokens with OpenRouter: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.OpenRouterTokenCounter = OpenRouterTokenCounter;
// Token Counter Factory with secure credential management
class TokenCounterFactory {
    static create(provider) {
        // Validate that credentials exist before creating the counter
        const credentialManager = credential_manager_1.CredentialManager.getInstance();
        if (!credentialManager.hasApiKey(provider)) {
            throw new types_1.AIProviderError(`API key not found for provider: ${provider}`);
        }
        switch (provider) {
            case 'anthropic':
                return new AnthropicTokenCounter();
            case 'openrouter':
                return new OpenRouterTokenCounter();
            default:
                throw new types_1.AIProviderError(`Unsupported provider for token counting: ${provider}`);
        }
    }
}
exports.TokenCounterFactory = TokenCounterFactory;
//# sourceMappingURL=token-counter.js.map