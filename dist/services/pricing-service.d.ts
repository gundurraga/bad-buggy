import { CostCalculation, TokenUsage } from "../types";
interface ModelPricing {
    input: number;
    output: number;
}
export interface ModelInfo {
    id: string;
    name: string;
    pricing: ModelPricing;
    provider: string;
}
export interface UsageWithCost {
    input_tokens: number;
    output_tokens: number;
    cost?: number;
    cost_details?: {
        upstream_inference_cost?: number;
    };
}
export interface PricingCache {
    [modelId: string]: {
        pricing: ModelPricing;
        timestamp: number;
        ttl: number;
    };
}
export declare class PricingService {
    private provider;
    private cache;
    private readonly CACHE_TTL;
    private credentialManager;
    constructor(provider: "anthropic" | "openrouter");
    getModelPricing(model: string): Promise<ModelPricing>;
    private fetchAnthropicPricing;
    private fetchOpenRouterPricing;
    calculateCost(usage: TokenUsage, model: string): Promise<CostCalculation>;
    calculateCostFromUsageWithCost(usageWithCost: UsageWithCost, pricing: ModelPricing): CostCalculation;
    clearExpiredCache(): void;
}
export declare class PricingServiceFactory {
    static create(provider: "anthropic" | "openrouter"): PricingService;
}
export {};
//# sourceMappingURL=pricing-service.d.ts.map