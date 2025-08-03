import { PullRequest } from "../types";
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
}, commentCount: number, prInfo?: {
    title: string;
    description: string;
    author: string;
    filesChanged: string[];
    additions: number;
    deletions: number;
}, costInfo?: {
    totalCost: number;
    inputCost: number;
    outputCost: number;
}) => string;
export declare const createReviewComment: (path: string, line: number, body: string, end_line?: number) => {
    path: string;
    line: number;
    body: string;
    end_line?: number;
    commentType: "diff";
};
export declare const createFileComment: (path: string, body: string) => {
    path: string;
    body: string;
    commentType: "file";
};
//# sourceMappingURL=github.d.ts.map