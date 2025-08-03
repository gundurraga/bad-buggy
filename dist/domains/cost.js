"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCost = exports.accumulateTokens = exports.calculateCost = void 0;
const pricing_service_1 = require("../services/pricing-service");
// New dynamic function: Calculate cost using PricingService with secure credential management
const calculateCost = async (usage, model, provider) => {
    const pricingService = pricing_service_1.PricingServiceFactory.create(provider);
    const cost = await pricingService.calculateCost(usage, model);
    return {
        inputCost: cost.inputCost,
        outputCost: cost.outputCost,
        totalCost: cost.totalCost,
    };
};
exports.calculateCost = calculateCost;
// Pure function to accumulate token usage
const accumulateTokens = (existing, additional) => {
    return {
        input: existing.input + additional.input,
        output: existing.output + additional.output,
    };
};
exports.accumulateTokens = accumulateTokens;
// Pure function to format cost for display
const formatCost = (cost) => {
    return `$${cost.toFixed(4)}`;
};
exports.formatCost = formatCost;
//# sourceMappingURL=cost.js.map