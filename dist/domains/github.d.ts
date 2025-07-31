import { PullRequest } from '../types';
export declare const extractPRInfo: (pr: PullRequest) => {
    number: number;
    headSha: string;
    baseSha: string;
    headRef: string;
    baseRef: string;
    author: string;
};
export declare const formatReviewBody: (model: string, totalTokens: {
    input: number;
    output: number;
}, commentCount: number) => string;
export declare const createReviewComment: (path: string, line: number, body: string) => {
    path: string;
    line: number;
    body: string;
};
//# sourceMappingURL=github.d.ts.map