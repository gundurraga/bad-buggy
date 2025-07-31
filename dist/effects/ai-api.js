"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callAIProvider = exports.callOpenRouter = exports.callAnthropic = void 0;
const types_1 = require("../types");
// Effect: Call Anthropic API
const callAnthropic = async (prompt, apiKey, model) => {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model,
            max_tokens: 4000,
            messages: [{ role: "user", content: prompt }],
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new types_1.AIProviderError(`Anthropic API error: ${errorText}`, response.status);
    }
    const data = await response.json();
    return {
        content: data.content[0].text,
        usage: {
            input_tokens: data.usage.input_tokens,
            output_tokens: data.usage.output_tokens,
        },
    };
};
exports.callAnthropic = callAnthropic;
// Effect: Call OpenRouter API
const callOpenRouter = async (prompt, apiKey, model) => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://github.com/gundurraga/bad-buggy",
            "X-Title": "Bad Buggy Code Reviewer",
        },
        body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 4000,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new types_1.AIProviderError(`OpenRouter API error: ${response.status} - ${errorText}`);
    }
    const data = (await response.json());
    return {
        content: data.choices[0].message.content,
        usage: {
            input_tokens: data.usage.prompt_tokens,
            output_tokens: data.usage.completion_tokens,
        },
    };
};
exports.callOpenRouter = callOpenRouter;
// Effect: Route to appropriate AI provider
const callAIProvider = async (provider, prompt, apiKey, model) => {
    try {
        switch (provider) {
            case "anthropic":
                return await (0, exports.callAnthropic)(prompt, apiKey, model);
            case "openrouter":
                return await (0, exports.callOpenRouter)(prompt, apiKey, model);
            default:
                throw new types_1.AIProviderError(`Unsupported AI provider: ${provider}`);
        }
    }
    catch (error) {
        if (error instanceof types_1.AIProviderError) {
            throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new types_1.AIProviderError(`AI provider call failed: ${errorMessage}`);
    }
};
exports.callAIProvider = callAIProvider;
//# sourceMappingURL=ai-api.js.map