export interface User {
    login: string;
    type: string;
}
export interface PullRequest {
    number: number;
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
export interface ReviewConfig {
    review_prompt: string;
    max_comments: number;
    prioritize_by_severity: boolean;
    review_aspects: string[];
    ignore_patterns: string[];
    allowed_users: string[];
}
export interface ActionInputs {
    githubToken: string;
    aiProvider: 'anthropic' | 'openrouter';
    apiKey: string;
    model: string;
    configFile: string;
}
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
export interface SecurityCheckResult {
    allowed: boolean;
    reason?: string;
    message?: string;
}
export declare class ConfigValidationError extends Error {
    constructor(message: string);
}
export declare class AIProviderError extends Error {
    statusCode?: number | undefined;
    constructor(message: string, statusCode?: number | undefined);
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
}
//# sourceMappingURL=types.d.ts.map