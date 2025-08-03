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
    repo: {
      full_name: string;
    };
  };
  base: {
    sha: string;
    ref: string;
    repo: {
      full_name: string;
    };
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
  custom_prompt?: string; // Additional user-specific prompt
  max_comments: number;
  ignore_patterns: string[];
  allowed_users: string[];
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
  severity: 'critical' | 'major' | 'suggestion';
}

export interface DiffChunk {
  content: string;
  fileChanges: FileChange[];
  repositoryContext?: RepositoryContext;
  contextualContent?: Record<string, string>; // ±100 lines around changes
}

export interface FileChange {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  contextualContent?: string; // ±100 lines around changes
}

// Incremental review types
export interface ReviewState {
  prNumber: number;
  lastReviewedSha: string;
  reviewedCommits: string[];
  timestamp: string;
}

export interface IncrementalDiff {
  newCommits: string[];
  changedFiles: FileChange[];
  isIncremental: boolean;
}

// Enhanced context types
export interface RepositoryContext {
  structure: RepositoryStructure;
  packageInfo?: PackageInfo;
}

export interface RepositoryStructure {
  directories: string[];
  files: FileInfo[];
  totalFiles: number;
  languages: Record<string, number>;
}

export interface FileInfo {
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  size?: number;
}

export interface PackageInfo {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
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