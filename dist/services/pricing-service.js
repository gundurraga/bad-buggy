"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingServiceFactory = exports.PricingService = void 0;
const types_1 = require("../types");
// Pricing Service for dynamic pricing and cost calculation
class PricingService {
    constructor(apiKey, provider) {
        this.apiKey = apiKey;
        this.provider = provider;
        this.cache = {};
        this.CACHE_TTL = 3600000; // 1 hour in milliseconds
    }
    // Get model pricing with caching
    async getModelPricing(model) {
        const cacheKey = `${this.provider}:${model}`;
        const cached = this.cache[cacheKey];
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.pricing;
        }
        let pricing;
        try {
            if (this.provider === "anthropic") {
                pricing = await this.fetchAnthropicPricing(model);
            }
            else {
                pricing = await this.fetchOpenRouterPricing(model);
            }
            // Cache the result
            this.cache[cacheKey] = {
                pricing,
                timestamp: Date.now(),
                ttl: this.CACHE_TTL,
            };
            return pricing;
        }
        catch (error) {
            // If fetching fails, try to use cached data even if expired
            if (cached) {
                console.warn(`Using expired pricing data for ${model}: ${error}`);
                return cached.pricing;
            }
            throw error;
        }
    }
    // Fetch Anthropic model pricing
    async fetchAnthropicPricing(model) {
        try {
            // Try to get pricing from Anthropic's models API
            const response = await fetch("https://api.anthropic.com/v1/models", {
                headers: {
                    "x-api-key": this.apiKey,
                    "anthropic-version": "2023-06-01",
                },
            });
            if (response.ok) {
                const data = (await response.json());
                const modelData = data.data?.find((m) => m.id === model);
                if (modelData?.pricing) {
                    return {
                        input: modelData.pricing.input_tokens_per_million / 1000000,
                        output: modelData.pricing.output_tokens_per_million / 1000000,
                    };
                }
            }
        }
        catch (error) {
            console.warn(`Failed to fetch Anthropic pricing from API: ${error}`);
        }
        // Fallback to known pricing (updated as of 2024)
        const knownPricing = {
            "claude-3-5-sonnet-20241022": { input: 0.000003, output: 0.000015 },
            "claude-3-5-sonnet-20240620": { input: 0.000003, output: 0.000015 },
            "claude-3-5-haiku-20241022": { input: 0.000001, output: 0.000005 },
            "claude-3-opus-20240229": { input: 0.000015, output: 0.000075 },
            "claude-3-sonnet-20240229": { input: 0.000003, output: 0.000015 },
            "claude-3-haiku-20240307": { input: 0.00000025, output: 0.00000125 },
        };
        const pricing = knownPricing[model];
        if (!pricing) {
            throw new types_1.AIProviderError(`Unknown Anthropic model pricing: ${model}`);
        }
        return pricing;
    }
    // Fetch OpenRouter model pricing
    async fetchOpenRouterPricing(model) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/models", {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            });
            if (!response.ok) {
                throw new types_1.AIProviderError(`OpenRouter models API error: ${response.statusText}`, response.status);
            }
            const data = (await response.json());
            const modelData = data.data?.find((m) => m.id === model);
            if (!modelData?.pricing) {
                throw new types_1.AIProviderError(`Model not found or no pricing available: ${model}`);
            }
            return {
                input: parseFloat(modelData.pricing.prompt) || 0,
                output: parseFloat(modelData.pricing.completion) || 0,
            };
        }
        catch (error) {
            if (error instanceof types_1.AIProviderError) {
                throw error;
            }
            throw new types_1.AIProviderError(`Failed to fetch OpenRouter pricing: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    // Calculate cost from usage data
    async calculateCost(usage, model) {
        // For OpenRouter, if cost is provided directly, use it
        if (this.provider === "openrouter" &&
            "cost" in usage &&
            typeof usage.cost === "number") {
            const directCost = usage.cost;
            const pricing = await this.getModelPricing(model);
            return {
                inputCost: usage.input * pricing.input,
                outputCost: usage.output * pricing.output,
                totalCost: directCost,
            };
        }
        // Standard calculation using pricing
        const pricing = await this.getModelPricing(model);
        const inputCost = usage.input * pricing.input;
        const outputCost = usage.output * pricing.output;
        return {
            inputCost,
            outputCost,
            totalCost: inputCost + outputCost,
        };
    }
    // Calculate cost from usage with cost data (for OpenRouter responses)
    calculateCostFromUsageWithCost(usageWithCost, pricing) {
        const inputCost = usageWithCost.input_tokens * pricing.input;
        const outputCost = usageWithCost.output_tokens * pricing.output;
        return {
            inputCost,
            outputCost,
            totalCost: usageWithCost.cost || inputCost + outputCost,
        };
    }
    // Clear expired cache entries
    clearExpiredCache() {
        const now = Date.now();
        Object.keys(this.cache).forEach((key) => {
            const entry = this.cache[key];
            if (now - entry.timestamp >= entry.ttl) {
                delete this.cache[key];
            }
        });
    }
}
exports.PricingService = PricingService;
// Factory for creating pricing services
class PricingServiceFactory {
    static create(provider, apiKey) {
        return new PricingService(apiKey, provider);
    }
}
exports.PricingServiceFactory = PricingServiceFactory;
//# sourceMappingURL=pricing-service.js.map