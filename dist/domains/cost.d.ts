import { CostCalculation, TokenUsage } from "../types";
export declare const calculateCost: (usage: TokenUsage, model: string, provider: "anthropic" | "openrouter") => Promise<CostCalculation>;
export declare const accumulateTokens: (existing: TokenUsage, additional: TokenUsage) => TokenUsage;
export declare const formatCost: (cost: number) => string;
//# sourceMappingURL=cost.d.ts.map