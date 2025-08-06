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
export interface ReviewConfig {
    review_prompt: string;
    custom_prompt?: string;
    max_comments: number;
    ignore_patterns: string[];
    allowed_users: string[];
}
export type Config = ReviewConfig;
export interface ActionInputs {
    githubToken: string;
    aiProvider: "anthropic" | "openrouter";
    apiKey: string;
    model: string;
    configFile: string;
}
export interface AIProviderResponse {
    content: string;
    usage?: {
        input_tokens: number;
        output_tokens: number;
        cost?: number;
        cost_details?: {
            upstream_inference_cost?: number;
        };
        cached_tokens?: number;
        reasoning_tokens?: number;
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
}
export interface ReviewComment {
    path: string;
    line?: number;
    start_line?: number;
    body: string;
    commentType?: 'diff' | 'file';
}
export interface DiffChunk {
    content: string;
    fileChanges: FileChange[];
    repositoryContext?: RepositoryContext;
    contextualContent?: Record<string, string>;
}
export interface PRContext {
    title: string;
    description: string;
    author: string;
    existingComments: string[];
}
export interface FileChange {
    filename: string;
    status: "added" | "modified" | "removed" | "renamed";
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
    contextualContent?: string;
}
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
    type: "file" | "directory";
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