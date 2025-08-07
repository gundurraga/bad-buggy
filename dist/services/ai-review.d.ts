import { ReviewConfig, ReviewComment, TokenUsage, DiffChunk, RepositoryContext, PRContext } from "../types";
/**
 * Service for handling Bad Buggy-powered code review operations
 */
export declare const buildReviewPrompt: (config: ReviewConfig, chunkContent: string, repositoryContext?: RepositoryContext, prContext?: PRContext) => string;
export declare const parseAIResponse: (responseContent: string) => ReviewComment[];
export declare const reviewChunk: (chunk: DiffChunk, config: ReviewConfig, provider: "anthropic" | "openrouter", model: string, prContext?: PRContext) => Promise<{
    comments: ReviewComment[];
    tokens: TokenUsage;
}>;
//# sourceMappingURL=ai-review.d.ts.map