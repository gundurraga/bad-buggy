import { TokenUsage, CostCalculation, ModelPricing } from '../types.js';
export declare const getModelPricing: (model: string) => ModelPricing;
export declare const calculateCost: (model: string, tokens: TokenUsage) => CostCalculation;
export declare const accumulateTokens: (existing: TokenUsage, additional: TokenUsage) => TokenUsage;
export declare const formatCost: (cost: number) => string;
//# sourceMappingURL=cost.d.ts.map