import { CostCalculation, TokenUsage } from "../types";
import { PricingServiceFactory } from "../services/pricing-service";

// New dynamic function: Calculate cost using PricingService with secure credential management
export const calculateCost = async (
  usage: TokenUsage,
  model: string,
  provider: "anthropic" | "openrouter"
): Promise<CostCalculation> => {
  const pricingService = PricingServiceFactory.create(provider);
  const cost = await pricingService.calculateCost(usage, model);
  return {
    inputCost: cost.inputCost,
    outputCost: cost.outputCost,
    totalCost: cost.totalCost,
  };
};

// Pure function to accumulate token usage
export const accumulateTokens = (
  existing: TokenUsage,
  additional: TokenUsage
): TokenUsage => {
  return {
    input: existing.input + additional.input,
    output: existing.output + additional.output,
  };
};

// Pure function to format cost for display
export const formatCost = (cost: number): string => {
  return `$${cost.toFixed(4)}`;
};
