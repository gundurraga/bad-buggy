const core = require("@actions/core");

class ConfigValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ConfigValidationError";
    this.field = field;
  }
}

function validateConfig(config) {
  const errors = [];

  // Validate required fields
  if (!config.review_prompt || typeof config.review_prompt !== "string") {
    errors.push("review_prompt must be a non-empty string");
  }

  if (typeof config.max_comments !== "number" || config.max_comments < 1) {
    errors.push("max_comments must be a positive number");
  }

  if (typeof config.prioritize_by_severity !== "boolean") {
    errors.push("prioritize_by_severity must be a boolean");
  }

  // Validate review_aspects
  if (!Array.isArray(config.review_aspects)) {
    errors.push("review_aspects must be an array");
  } else {
    const validAspects = [
      "bugs",
      "security_vulnerabilities",
      "performance_issues",
      "code_quality",
      "best_practices",
      "architecture_suggestions",
      "code_organization",
      "code_readability",
      "code_maintainability",
    ];
    const invalidAspects = config.review_aspects.filter(
      (aspect) => !validAspects.includes(aspect)
    );
    if (invalidAspects.length > 0) {
      errors.push(
        `Invalid review aspects: ${invalidAspects.join(
          ", "
        )}. Valid aspects: ${validAspects.join(", ")}`
      );
    }
  }

  // Validate ignore_patterns
  if (!Array.isArray(config.ignore_patterns)) {
    errors.push("ignore_patterns must be an array");
  }

  // Validate allowed_users
  if (!Array.isArray(config.allowed_users)) {
    errors.push("allowed_users must be an array");
  }

  // Validate ranges
  if (config.max_comments > 20) {
    core.warning(
      "max_comments is very high (>20), this may result in high costs"
    );
  }

  if (config.review_prompt.length > 10000) {
    core.warning(
      "review_prompt is very long (>10k chars), this may result in high token costs"
    );
  }

  if (errors.length > 0) {
    throw new ConfigValidationError(
      `Configuration validation failed:\n${errors.join("\n")}`,
      "config"
    );
  }

  return config;
}

function validateInputs(inputs) {
  const { githubToken, aiProvider, apiKey, model } = inputs;
  const errors = [];

  if (!githubToken) {
    errors.push("github-token is required");
  }

  if (!aiProvider) {
    errors.push("ai-provider is required");
  } else if (!["anthropic", "openrouter"].includes(aiProvider)) {
    errors.push("ai-provider must be 'anthropic' or 'openrouter'");
  }

  if (!apiKey) {
    errors.push("api-key is required");
  }

  if (!model) {
    errors.push("model is required");
  }

  if (errors.length > 0) {
    throw new ConfigValidationError(
      `Input validation failed:\n${errors.join("\n")}`,
      "inputs"
    );
  }

  return inputs;
}

module.exports = {
  validateConfig,
  validateInputs,
  ConfigValidationError,
};
