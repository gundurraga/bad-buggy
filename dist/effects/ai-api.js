"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callAIProvider = exports.callOpenRouter = exports.callAnthropic = exports.callWithRetry = void 0;
const types_1 = require("../types");
const credential_manager_1 = require("../security/credential-manager");
const constants_1 = require("../constants");
// Helper function to determine if an error should be retried
const shouldRetry = (error) => {
    if (error instanceof types_1.AIProviderError && error.statusCode) {
        // Retry on server errors (5xx) and rate limits (429)
        return error.statusCode >= 500 || error.statusCode === 429;
    }
    // Retry on network errors
    return (error instanceof Error &&
        (error.message.includes("network") ||
            error.message.includes("timeout") ||
            error.message.includes("ECONNRESET")));
};
// Generic retry wrapper for API calls
const callWithRetry = async (apiCall, retries = constants_1.REVIEW_CONSTANTS.MAX_RETRIES) => {
    try {
        return await apiCall();
    }
    catch (error) {
        if (retries > 0 && shouldRetry(error)) {
            await new Promise((resolve) => setTimeout(resolve, constants_1.REVIEW_CONSTANTS.RETRY_DELAY_MS));
            return (0, exports.callWithRetry)(apiCall, retries - 1);
        }
        throw error;
    }
};
exports.callWithRetry = callWithRetry;
// Effect: Call Anthropic API
const callAnthropic = async (prompt, model) => {
    return (0, exports.callWithRetry)(async () => {
        const credentialManager = credential_manager_1.CredentialManager.getInstance();
        const apiKey = credentialManager.getApiKey("anthropic");
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model,
                max_tokens: constants_1.REVIEW_CONSTANTS.MAX_TOKENS,
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
    });
};
exports.callAnthropic = callAnthropic;
// Effect: Call OpenRouter API
const callOpenRouter = async (prompt, model) => {
    return (0, exports.callWithRetry)(async () => {
        const credentialManager = credential_manager_1.CredentialManager.getInstance();
        const apiKey = credentialManager.getApiKey("openrouter");
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
                max_tokens: constants_1.REVIEW_CONSTANTS.MAX_TOKENS,
                usage: {
                    include: true, // Enable OpenRouter usage accounting
                },
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
                cost: data.usage.cost,
                cost_details: data.usage.cost_details,
                cached_tokens: data.usage.prompt_tokens_details?.cached_tokens,
                reasoning_tokens: data.usage.completion_tokens_details?.reasoning_tokens,
            },
        };
    });
};
exports.callOpenRouter = callOpenRouter;
// Effect: Route to appropriate AI provider
const callAIProvider = async (provider, prompt, model) => {
    try {
        switch (provider) {
            case "anthropic":
                return await (0, exports.callAnthropic)(prompt, model);
            case "openrouter":
                return await (0, exports.callOpenRouter)(prompt, model);
            default:
                throw new types_1.AIProviderError(`${constants_1.ERROR_MESSAGES.UNSUPPORTED_PROVIDER}: ${provider}`);
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