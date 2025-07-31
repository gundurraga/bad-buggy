import { getOctokit } from '@actions/github';
import { Context } from '@actions/github/lib/context';
import { FileChange, ReviewComment, PullRequest } from '../types';
export declare const getPRDiff: (octokit: ReturnType<typeof getOctokit>, context: Context, pr: PullRequest) => Promise<FileChange[]>;
export declare const checkUserPermissions: (octokit: ReturnType<typeof getOctokit>, owner: string, repo: string, username: string) => Promise<string>;
export declare const postReview: (octokit: ReturnType<typeof getOctokit>, context: Context, pr: PullRequest, comments: ReviewComment[], body: string, fileChanges?: FileChange[]) => Promise<void>;
//# sourceMappingURL=github-api.d.ts.map