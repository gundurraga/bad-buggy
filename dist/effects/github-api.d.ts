import { getOctokit } from "@actions/github";
import { Context } from "@actions/github/lib/context";
import { FileChange, ReviewComment, PullRequest, ReviewState, IncrementalDiff, RepositoryContext, RepositoryStructure, PackageInfo } from "../types";
export declare const getPRDiff: (octokit: ReturnType<typeof getOctokit>, context: Context, pr: PullRequest) => Promise<FileChange[]>;
export declare const checkUserPermissions: (octokit: ReturnType<typeof getOctokit>, owner: string, repo: string, username: string) => Promise<string>;
export declare const postReview: (octokit: ReturnType<typeof getOctokit>, context: Context, pr: PullRequest, comments: ReviewComment[], body: string, fileChanges?: FileChange[]) => Promise<void>;
export declare const getPRCommits: (octokit: ReturnType<typeof getOctokit>, context: Context, pr: PullRequest) => Promise<string[]>;
export declare const getReviewState: (octokit: ReturnType<typeof getOctokit>, context: Context, pr: PullRequest) => Promise<ReviewState | null>;
export declare const saveReviewState: (octokit: ReturnType<typeof getOctokit>, context: Context, pr: PullRequest, state: ReviewState) => Promise<void>;
export declare const getIncrementalDiff: (octokit: ReturnType<typeof getOctokit>, context: Context, pr: PullRequest, lastReviewedSha?: string) => Promise<IncrementalDiff>;
export declare const getRepositoryStructure: (octokit: ReturnType<typeof getOctokit>, context: Context, pr: PullRequest) => Promise<RepositoryStructure>;
export declare const getFileContent: (octokit: ReturnType<typeof getOctokit>, context: Context, filePath: string, sha: string) => Promise<string | null>;
export declare const getPackageInfo: (octokit: ReturnType<typeof getOctokit>, context: Context, sha: string) => Promise<PackageInfo | null>;
export declare const getExistingReviewComments: (octokit: ReturnType<typeof getOctokit>, context: Context, pr: PullRequest) => Promise<string[]>;
export declare const getRepositoryContext: (octokit: ReturnType<typeof getOctokit>, context: Context, pr: PullRequest) => Promise<RepositoryContext>;
//# sourceMappingURL=github-api.d.ts.map