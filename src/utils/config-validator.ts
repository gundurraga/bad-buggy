import * as core from '@actions/core';
import { Config } from '../types';

export class ConfigValidationError extends Error {
  public readonly field: string;

  constructor(message: string, field: string) {
    super(message);
    this.name = 'ConfigValidationError';
    this.field = field;
  }
}

interface ValidationInputs {
  githubToken: string;
  aiProvider: string;
  apiKey: string;
  model: string;
}

export function validateConfig(config: Config): Config {
  const errors: string[] = [];

  // Validate required fields
  if (
    !config.review_prompt ||
    typeof config.review_prompt !== 'string' ||
    config.review_prompt.trim() === ''
  ) {
    errors.push('review_prompt must be a non-empty string');
  }

  if (typeof config.max_comments !== 'number' || config.max_comments < 1) {
    errors.push('max_comments must be a positive number');
  }

  if (typeof config.prioritize_by_severity !== 'boolean') {
    errors.push('prioritize_by_severity must be a boolean');
  }

  // Validate review_aspects
  if (!Array.isArray(config.review_aspects)) {
    errors.push('review_aspects must be an array');
  }

  // Validate ignore_patterns
  if (!Array.isArray(config.ignore_patterns)) {
    errors.push('ignore_patterns must be an array');
  }

  // Validate allowed_users
  if (!Array.isArray(config.allowed_users)) {
    errors.push('allowed_users must be an array');
  }

  // Validate ranges
  if (config.max_comments > 20) {
    core.warning(
      'max_comments is very high (>20), this may result in high costs'
    );
  }

  if (config.review_prompt.length > 10000) {
    core.warning(
      'review_prompt is very long (>10k chars), this may result in high token costs'
    );
  }

  if (errors.length > 0) {
    throw new ConfigValidationError(
      `Configuration validation failed:\n${errors.join('\n')}`,
      'config'
    );
  }

  return config;
}

export function validateInputs(inputs: ValidationInputs): ValidationInputs {
  const { githubToken, aiProvider, apiKey, model } = inputs;
  const errors: string[] = [];

  if (!githubToken) {
    errors.push('github-token is required');
  } else if (!githubToken.match(/^(ghp_|ghs_|github_pat_)/)) {
    errors.push(
      'github-token must be a valid GitHub token (starts with ghp_, ghs_, or github_pat_)'
    );
  }

  if (!aiProvider) {
    errors.push('ai-provider is required');
  } else if (!['anthropic', 'openrouter'].includes(aiProvider)) {
    errors.push("ai-provider must be 'anthropic' or 'openrouter'");
  }

  if (!apiKey) {
    errors.push('api-key is required');
  } else {
    // Basic API key format validation
    if (aiProvider === 'anthropic' && !apiKey.startsWith('sk-ant-')) {
      errors.push("Anthropic API key should start with 'sk-ant-'");
    } else if (aiProvider === 'openrouter' && !apiKey.startsWith('sk-or-')) {
      errors.push("OpenRouter API key should start with 'sk-or-'");
    } else if (apiKey.length < 20) {
      errors.push('API key seems too short to be valid');
    }
  }

  if (!model) {
    errors.push('model is required');
  }

  if (errors.length > 0) {
    throw new ConfigValidationError(
      `Input validation failed:\n${errors.join('\n')}`,
      'inputs'
    );
  }

  return inputs;
}