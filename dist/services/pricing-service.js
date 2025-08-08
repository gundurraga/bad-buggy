"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingServiceFactory = exports.PricingService = void 0;
const types_1 = require("../types");
const credential_manager_1 = require("../security/credential-manager");
// Pricing Service for dynamic pricing and cost calculation
class PricingService {
    constructor(provider) {
        this.provider = provider;
        this.credentialManager = credential_manager_1.CredentialManager.getInstance();
    }
    // Get model pricing
    async getModelPricing(model) {
        if (this.provider === "anthropic") {
            return await this.fetchAnthropicPricing(model);
        }
        else {
            return await this.fetchOpenRouterPricing(model);
        }
    }
    // Fetch Anthropic model pricing
    async fetchAnthropicPricing(model) {
        try {
            const apiKey = this.credentialManager.getApiKey("anthropic");
            // Try to get pricing from Anthropic's models API
            const response = await fetch("https://api.anthropic.com/v1/models", {
                headers: {
                    "x-api-key": apiKey,
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
        // If API pricing is not available, we cannot provide fallback pricing
        // as prices change frequently. User should check their provider's pricing page.
        throw new types_1.AIProviderError(`Unable to fetch real-time pricing for model: ${model}. ` +
            `Please check https://www.anthropic.com/pricing for current rates.`);
    }
    // Fetch OpenRouter model pricing
    async fetchOpenRouterPricing(model) {
        try {
            const apiKey = this.credentialManager.getApiKey("openrouter");
            const response = await fetch("https://openrouter.ai/api/v1/models", {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
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
}
exports.PricingService = PricingService;
// Factory for creating pricing services
class PricingServiceFactory {
    static create(provider) {
        // Validate that credentials exist before creating the service
        const credentialManager = credential_manager_1.CredentialManager.getInstance();
        if (!credentialManager.hasApiKey(provider)) {
            throw new types_1.AIProviderError(`API key not found for provider: ${provider}`);
        }
        return new PricingService(provider);
    }
}
exports.PricingServiceFactory = PricingServiceFactory;
//# sourceMappingURL=pricing-service.js.map