import { TokenUsage, CostCalculation, ModelPricing } from '../types.js';

// Model pricing configuration (per 1M tokens)
const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-4': { input: 3.0, output: 15.0 },
  'claude-4-opus': { input: 15.0, output: 75.0 },
};

// Pure function to get model pricing
export const getModelPricing = (model: string): ModelPricing => {
  return MODEL_PRICING[model] || MODEL_PRICING['claude-4'];
};

// Pure function to calculate cost
export const calculateCost = (model: string, tokens: TokenUsage): CostCalculation => {
  const pricing = getModelPricing(model);
  const inputCost = (tokens.input / 1000000) * pricing.input;
  const outputCost = (tokens.output / 1000000) * pricing.output;
  const totalCost = inputCost + outputCost;
  
  return { inputCost, outputCost, totalCost, pricing };
};

// Pure function to accumulate token usage
export const accumulateTokens = (existing: TokenUsage, additional: TokenUsage): TokenUsage => {
  return {
    input: existing.input + additional.input,
    output: existing.output + additional.output
  };
};

// Pure function to format cost for display
export const formatCost = (cost: number): string => {
  return `$${cost.toFixed(4)}`;
};