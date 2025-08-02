import { ReviewConfig, ActionInputs, ValidationResult, ConfigValidationError } from './types';

// Pure function to validate configuration
export const validateConfig = (config: ReviewConfig): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate review_prompt
  if (!config.review_prompt || typeof config.review_prompt !== 'string' || config.review_prompt.trim() === '') {
    errors.push('review_prompt must be a non-empty string');
  } else if (config.review_prompt.length > 10000) {
    warnings.push('review_prompt is very long and may cause API issues');
  }

  // Validate max_comments
  if (typeof config.max_comments !== 'number' || config.max_comments <= 0) {
    errors.push('max_comments must be a positive number');
  } else if (config.max_comments > 20) {
    warnings.push('max_comments is high and may cause API rate limits');
  }

  // Validate arrays
  if (!Array.isArray(config.ignore_patterns)) {
    errors.push('ignore_patterns must be an array');
  }
  if (!Array.isArray(config.allowed_users)) {
    errors.push('allowed_users must be an array');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// Pure function to validate inputs
export const validateInputs = (inputs: ActionInputs): ValidationResult => {
  const errors: string[] = [];

  // Validate GitHub token
  if (!inputs.githubToken || typeof inputs.githubToken !== 'string') {
    errors.push('GitHub token is required');
  } else if (!inputs.githubToken.startsWith('ghp_') && !inputs.githubToken.startsWith('ghs_') && !inputs.githubToken.startsWith('github_pat_')) {
    errors.push('GitHub token format appears invalid');
  }

  // Validate AI provider
  if (!['anthropic', 'openrouter'].includes(inputs.aiProvider)) {
    errors.push('AI provider must be either "anthropic" or "openrouter"');
  }

  // Validate API key
  if (!inputs.apiKey || typeof inputs.apiKey !== 'string') {
    errors.push('API key is required');
  } else {
    // Basic format validation based on provider
    if (inputs.aiProvider === 'anthropic' && !inputs.apiKey.startsWith('sk-ant-')) {
      errors.push('Anthropic API key format appears invalid (should start with sk-ant-)');
    } else if (inputs.aiProvider === 'openrouter' && !inputs.apiKey.startsWith('sk-or-')) {
      errors.push('OpenRouter API key format appears invalid (should start with sk-or-)');
    }
  }

  // Validate model
  if (!inputs.model || typeof inputs.model !== 'string') {
    errors.push('Model is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Effect: Validate and throw if invalid
export const validateAndThrow = (validation: ValidationResult, errorType: string): void => {
  if (!validation.isValid) {
    throw new ConfigValidationError(`${errorType}: ${validation.errors.join(', ')}`);
  }
};