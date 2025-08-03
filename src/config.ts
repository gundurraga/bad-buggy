import { ReviewConfig, ActionInputs, ValidationResult, ConfigValidationError } from './types';
import { loadConfigFromFile } from './effects/file-system';
import * as core from '@actions/core';

// Default configuration for Bad Buggy code review
export const DEFAULT_CONFIG: ReviewConfig = {
  review_prompt: `You are an experienced code reviewer providing thoughtful, constructive feedback that helps developers grow.

## Review Philosophy
- Focus on the 5 most impactful insights that will genuinely improve the code
- Explain the "why" behind each suggestion to teach, not just point out issues
- Think architecturally about design patterns, maintainability, and long-term implications
- Be constructive and motivational - build up developers, don't tear them down
- Provide actionable suggestions with clear reasoning
- Use markdown formatting to make your comments clear and well-structured
- Write comments as long as needed to fully explain the insight and teach effectively

## What to Look For
**Architecture & Design:**
- SOLID principles violations and opportunities
- Design patterns that could improve the solution
- Anti-patterns that should be refactored
- Code organization and separation of concerns

**Code Quality:**
- Readability and expressiveness
- Error handling and edge cases
- Performance implications
- Security considerations (OWASP guidelines)

**Best Practices:**
- Language/framework-specific conventions
- Maintainability and future-proofing
- Code reusability and DRY principles
- Documentation and self-documenting code

## Communication Style
- Be specific about what to change and why
- Include detailed explanations that help the developer learn
- Acknowledge good practices when you see them
- Frame suggestions positively ("Consider..." rather than "Don't...")
- Focus on impact: explain how the change improves the codebase
- Use markdown formatting for better readability

## Output Guidelines
- Limit yourself to 5 high-impact comments maximum (could be less)
- Each comment should teach something valuable
- Skip minor style issues unless they affect readability significantly
- Prioritize comments that prevent bugs, improve architecture, or enhance maintainability
- Write comprehensive comments that fully explain the reasoning

Remember: You're not just reviewing code, you're helping a colleague become a better developer.`,
  max_comments: 5,
  ignore_patterns: [
    "*.lock",
    "*.log",
    "node_modules/**",
    "dist/**",
    "build/**",
    "*.min.js",
    "*.min.css",
  ],
  allowed_users: [],
};

// Pure function to merge configurations
export const mergeConfig = (defaultConfig: ReviewConfig, userConfig: Partial<ReviewConfig>): ReviewConfig => {
  return {
    ...defaultConfig,
    ...userConfig
  };
};

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

  // Log warnings
  warnings.forEach(warning => core.warning(warning));

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

// Effect: Load and merge configuration
export const loadConfig = async (configFile: string): Promise<ReviewConfig> => {
  const userConfig = await loadConfigFromFile(configFile);
  return userConfig ? mergeConfig(DEFAULT_CONFIG, userConfig) : DEFAULT_CONFIG;
};