import { ReviewConfig, ReviewComment, TokenUsage, DiffChunk } from '../types';
/**
 * Service for handling Bad Buggy-powered code review operations
 */
export declare const buildReviewPrompt: (config: ReviewConfig, chunkContent: string) => string;
export declare const parseAIResponse: (responseContent: string) => ReviewComment[];
export declare const reviewChunk: (chunk: DiffChunk, config: ReviewConfig, provider: "anthropic" | "openrouter", apiKey: string, model: string) => Promise<{
    comments: ReviewComment[];
    tokens: TokenUsage;
}>;
//# sourceMappingURL=ai-review.d.ts.map