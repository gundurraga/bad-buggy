// Model pricing (per 1M tokens)
const MODEL_PRICING = {
  "claude-4": { input: 3.0, output: 15.0 },
  "claude-4-opus": { input: 15.0, output: 75.0 },
  "claude-4-sonnet": { input: 3.0, output: 15.0 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
};

class CostCalculator {
  constructor(model) {
    this.model = model;
    this.pricing = MODEL_PRICING[model] || MODEL_PRICING["claude-4"];
  }

  calculate(tokens) {
    const inputCost = (tokens.input / 1000000) * this.pricing.input;
    const outputCost = (tokens.output / 1000000) * this.pricing.output;
    const totalCost = inputCost + outputCost;

    return {
      inputCost,
      outputCost,
      totalCost,
      model: this.model,
      tokens,
    };
  }

  formatCostSummary(tokens) {
    const cost = this.calculate(tokens);
    return {
      summary: `**Review Cost:**
- Model: ${cost.model}
- Total cost: $${cost.totalCost.toFixed(4)}
- Tokens: ${cost.tokens.input.toLocaleString()} input, ${cost.tokens.output.toLocaleString()} output`,

      logSummary: [
        "=== Bad-Buggy Cost Summary ===",
        `Model: ${cost.model}`,
        `Input tokens: ${cost.tokens.input.toLocaleString()}`,
        `Output tokens: ${cost.tokens.output.toLocaleString()}`,
        `Total cost: $${cost.totalCost.toFixed(4)}`,
        "============================",
      ].join("\n"),
    };
  }
}

module.exports = { CostCalculator, MODEL_PRICING };
