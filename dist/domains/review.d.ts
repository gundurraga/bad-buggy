import { ReviewComment, DiffChunk, FileChange, ReviewConfig, RepositoryContext, IncrementalDiff } from "../types";
import { getOctokit } from '@actions/github';
import { Context } from '@actions/github/lib/context';
export declare const countTokens: (text: string, model: string) => number;
export declare const shouldIgnoreFile: (filename: string, config: ReviewConfig) => boolean;
export declare const chunkDiff: (diff: FileChange[], config: ReviewConfig, repositoryContext?: RepositoryContext, octokit?: ReturnType<typeof getOctokit>, context?: Context, sha?: string) => Promise<DiffChunk[]>;
export declare const processIncrementalDiff: (incrementalDiff: IncrementalDiff, config: ReviewConfig) => {
    shouldReview: boolean;
    message?: string;
};
export declare const processComments: (comments: ReviewComment[], _config: ReviewConfig) => ReviewComment[];
//# sourceMappingURL=review.d.ts.map