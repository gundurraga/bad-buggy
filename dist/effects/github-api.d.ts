import { getOctokit } from '@actions/github';
import { FileChange, ReviewComment } from '../types';
export declare const getPRDiff: (octokit: ReturnType<typeof getOctokit>, context: any, pr: any) => Promise<FileChange[]>;
export declare const checkUserPermissions: (octokit: ReturnType<typeof getOctokit>, owner: string, repo: string, username: string) => Promise<string>;
export declare const postReview: (octokit: ReturnType<typeof getOctokit>, context: any, pr: any, comments: ReviewComment[], body: string) => Promise<void>;
//# sourceMappingURL=github-api.d.ts.map