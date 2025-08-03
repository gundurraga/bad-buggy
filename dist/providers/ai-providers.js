"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProviderError = void 0;
exports.callAIProvider = callAIProvider;
class AIProviderError extends Error {
    constructor(message, provider, status) {
        super(message);
        this.name = 'AIProviderError';
        this.provider = provider;
        this.status = status;
    }
}
exports.AIProviderError = AIProviderError;
async function callAnthropic(prompt, model, apiKey) {
    if (!apiKey) {
        throw new AIProviderError('Anthropic API key is required', 'anthropic');
    }
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4000,
        }),
    });
    if (!response.ok) {
        throw new AIProviderError(`Anthropic API error: ${response.statusText}`, 'anthropic', response.status);
    }
    const data = await response.json();
    return data.content[0].text;
}
async function callOpenRouter(prompt, model, apiKey) {
    if (!apiKey) {
        throw new AIProviderError('OpenRouter API key is required', 'openrouter');
    }
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://github.com/gundurraga/bad-buggy',
            'X-Title': 'bad-buggy',
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            usage: {
                include: true, // Enable OpenRouter usage accounting
            },
        }),
    });
    if (!response.ok) {
        throw new AIProviderError(`OpenRouter API error: ${response.statusText}`, 'openrouter', response.status);
    }
    const data = await response.json();
    return data.choices[0].message.content;
}
async function callAIProvider(provider, prompt, model, apiKey) {
    try {
        switch (provider) {
            case 'anthropic':
                return await callAnthropic(prompt, model, apiKey);
            case 'openrouter':
                return await callOpenRouter(prompt, model, apiKey);
            default:
                throw new AIProviderError(`Unknown provider: ${provider}`, provider);
        }
    }
    catch (error) {
        if (error instanceof AIProviderError) {
            throw error;
        }
        throw new AIProviderError(`Provider call failed: ${error instanceof Error ? error.message : 'Unknown error'}`, provider);
    }
}
//# sourceMappingURL=ai-providers.js.map