"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCost = exports.accumulateTokens = exports.calculateCost = exports.getModelPricing = void 0;
// Model pricing configuration (per 1M tokens)
const MODEL_PRICING = {
    'claude-4': { input: 3.0, output: 15.0 },
    'claude-4-opus': { input: 15.0, output: 75.0 },
};
// Pure function to get model pricing
const getModelPricing = (model) => {
    return MODEL_PRICING[model] || MODEL_PRICING['claude-4'];
};
exports.getModelPricing = getModelPricing;
// Pure function to calculate cost
const calculateCost = (model, tokens) => {
    const pricing = (0, exports.getModelPricing)(model);
    const inputCost = (tokens.input / 1000000) * pricing.input;
    const outputCost = (tokens.output / 1000000) * pricing.output;
    const totalCost = inputCost + outputCost;
    return { inputCost, outputCost, totalCost, pricing };
};
exports.calculateCost = calculateCost;
// Pure function to accumulate token usage
const accumulateTokens = (existing, additional) => {
    return {
        input: existing.input + additional.input,
        output: existing.output + additional.output
    };
};
exports.accumulateTokens = accumulateTokens;
// Pure function to format cost for display
const formatCost = (cost) => {
    return `$${cost.toFixed(4)}`;
};
exports.formatCost = formatCost;
//# sourceMappingURL=cost.js.map