import {
  AIProviderError,
  CostCalculation,
  TokenUsage,
} from "../types";

// Internal pricing interface for service calculations
interface ModelPricing {
  input: number;
  output: number;
}

// Enhanced interfaces for pricing
export interface ModelInfo {
  id: string;
  name: string;
  pricing: ModelPricing;
  provider: string;
}

export interface UsageWithCost {
  input_tokens: number;
  output_tokens: number;
  cost?: number; // OpenRouter provides this directly
  cost_details?: {
    upstream_inference_cost?: number;
  };
}

// API response interfaces
interface AnthropicModel {
  id: string;
  pricing?: {
    input_tokens_per_million: number;
    output_tokens_per_million: number;
  };
}

interface AnthropicModelsResponse {
  data?: AnthropicModel[];
}

interface OpenRouterModel {
  id: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

interface OpenRouterModelsResponse {
  data?: OpenRouterModel[];
}

export interface PricingCache {
  [modelId: string]: {
    pricing: ModelPricing;
    timestamp: number;
    ttl: number;
  };
}

// Pricing Service for dynamic pricing and cost calculation
export class PricingService {
  private cache: PricingCache = {};
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds

  constructor(
    private apiKey: string,
    private provider: "anthropic" | "openrouter"
  ) {}

  // Get model pricing with caching
  async getModelPricing(model: string): Promise<ModelPricing> {
    const cacheKey = `${this.provider}:${model}`;
    const cached = this.cache[cacheKey];

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.pricing;
    }

    let pricing: ModelPricing;

    try {
      if (this.provider === "anthropic") {
        pricing = await this.fetchAnthropicPricing(model);
      } else {
        pricing = await this.fetchOpenRouterPricing(model);
      }

      // Cache the result
      this.cache[cacheKey] = {
        pricing,
        timestamp: Date.now(),
        ttl: this.CACHE_TTL,
      };

      return pricing;
    } catch (error) {
      // If fetching fails, try to use cached data even if expired
      if (cached) {
        console.warn(`Using expired pricing data for ${model}: ${error}`);
        return cached.pricing;
      }
      throw error;
    }
  }

  // Fetch Anthropic model pricing
  private async fetchAnthropicPricing(model: string): Promise<ModelPricing> {
    try {
      // Try to get pricing from Anthropic's models API
      const response = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
      });

      if (response.ok) {
        const data = (await response.json()) as AnthropicModelsResponse;
        const modelData = data.data?.find(
          (m: AnthropicModel) => m.id === model
        );
        if (modelData?.pricing) {
          return {
            input: modelData.pricing.input_tokens_per_million / 1000000,
            output: modelData.pricing.output_tokens_per_million / 1000000,
          };
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch Anthropic pricing from API: ${error}`);
    }

    // Fallback to known pricing (updated as of 2024)
    const knownPricing: Record<string, ModelPricing> = {
      "claude-3-5-sonnet-20241022": { input: 0.000003, output: 0.000015 },
      "claude-3-5-sonnet-20240620": { input: 0.000003, output: 0.000015 },
      "claude-3-5-haiku-20241022": { input: 0.000001, output: 0.000005 },
      "claude-3-opus-20240229": { input: 0.000015, output: 0.000075 },
      "claude-3-sonnet-20240229": { input: 0.000003, output: 0.000015 },
      "claude-3-haiku-20240307": { input: 0.00000025, output: 0.00000125 },
    };

    const pricing = knownPricing[model];
    if (!pricing) {
      throw new AIProviderError(`Unknown Anthropic model pricing: ${model}`);
    }

    return pricing;
  }

  // Fetch OpenRouter model pricing
  private async fetchOpenRouterPricing(model: string): Promise<ModelPricing> {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new AIProviderError(
          `OpenRouter models API error: ${response.statusText}`,
          response.status
        );
      }

      const data = (await response.json()) as OpenRouterModelsResponse;
      const modelData = data.data?.find((m: OpenRouterModel) => m.id === model);

      if (!modelData?.pricing) {
        throw new AIProviderError(
          `Model not found or no pricing available: ${model}`
        );
      }

      return {
        input: parseFloat(modelData.pricing.prompt) || 0,
        output: parseFloat(modelData.pricing.completion) || 0,
      };
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError(
        `Failed to fetch OpenRouter pricing: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Calculate cost from usage data
  async calculateCost(
    usage: TokenUsage,
    model: string
  ): Promise<CostCalculation> {
    // For OpenRouter, if cost is provided directly, use it
    if (
      this.provider === "openrouter" &&
      "cost" in usage &&
      typeof usage.cost === "number"
    ) {
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
  calculateCostFromUsageWithCost(
    usageWithCost: UsageWithCost,
    pricing: ModelPricing
  ): CostCalculation {
    const inputCost = usageWithCost.input_tokens * pricing.input;
    const outputCost = usageWithCost.output_tokens * pricing.output;

    return {
      inputCost,
      outputCost,
      totalCost: usageWithCost.cost || inputCost + outputCost,
    };
  }

  // Clear expired cache entries
  clearExpiredCache(): void {
    const now = Date.now();
    Object.keys(this.cache).forEach((key) => {
      const entry = this.cache[key];
      if (now - entry.timestamp >= entry.ttl) {
        delete this.cache[key];
      }
    });
  }
}

// Factory for creating pricing services
export class PricingServiceFactory {
  static create(
    provider: "anthropic" | "openrouter",
    apiKey: string
  ): PricingService {
    return new PricingService(apiKey, provider);
  }
}
