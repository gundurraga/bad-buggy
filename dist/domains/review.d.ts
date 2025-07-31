import { ReviewComment, DiffChunk, FileChange, ReviewConfig } from '../types';
export declare const countTokens: (text: string, model: string) => number;
export declare const shouldIgnoreFile: (filename: string, config: ReviewConfig) => boolean;
export declare const chunkDiff: (diff: FileChange[], config: ReviewConfig) => DiffChunk[];
export declare const processComments: (comments: ReviewComment[], config: ReviewConfig) => ReviewComment[];
//# sourceMappingURL=review.d.ts.map