// Core domain types
export interface User {
  login: string;
  type: string;
}

export interface PullRequest {
  number: number;
  title?: string;
  body?: string;
  html_url?: string;
  additions?: number;
  deletions?: number;
  head: {
    sha: string;
    ref: string;
  };
  base: {
    sha: string;
    ref: string;
  };
  user: User;
}

export interface GitHubContext {
  repo: {
    owner: string;
    repo: string;
  };
  payload: {
    pull_request: PullRequest;
    sender: User;
  };
}

// Configuration types
export interface ReviewConfig {
  review_prompt: string;
  max_comments: number;
  prioritize_by_severity: boolean;
  review_aspects: string[];
  ignore_patterns: string[];
  allowed_users: string[];
  allowed_users_env?: string;
}

// Type alias for compatibility
export type Config = ReviewConfig;

export interface ActionInputs {
  githubToken: string;
  aiProvider: 'anthropic' | 'openrouter';
  apiKey: string;
  model: string;
  configFile: string;
}

// AI Provider types
export interface AIProviderResponse {
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface CostCalculation {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  pricing: ModelPricing;
}

export interface ModelPricing {
  input: number;
  output: number;
}

// Review types
export interface ReviewComment {
  path: string;
  line: number;
  body: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
}

export interface DiffChunk {
  content: string;
  files: string[];
  size: number;
}

export interface FileChange {
  filename: string;
  status: 'added' | 'modified' | 'removed';
  patch?: string;
}

// Security types
export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  message?: string;
}

// Error types
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export class AIProviderError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'AIProviderError';
  }
}

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}