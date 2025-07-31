import * as github from '@actions/github';
import { ActionInputs, ReviewConfig, TokenUsage, ReviewComment, PullRequest, User, FileChange } from '../types';
/**
 * Workflow orchestrator for the Bad Buggy code review process
 */
export declare class ReviewWorkflow {
    private octokit;
    private context;
    private inputs;
    private config;
    constructor(octokit: ReturnType<typeof github.getOctokit>, context: typeof github.context, inputs: ActionInputs, config: ReviewConfig);
    validateInputs(): Promise<void>;
    validateConfig(): Promise<void>;
    validatePullRequest(): Promise<{
        pr: PullRequest;
        triggeringUser: User;
        repoOwner: string;
    }>;
    performSecurityChecks(pr: PullRequest, triggeringUser: User, repoOwner: string): Promise<string[]>;
    checkUserPermissions(triggeringUser: User, repoOwner: string): Promise<void>;
    processAndReviewDiff(): Promise<{
        comments: ReviewComment[];
        tokens: TokenUsage;
        fileChanges: FileChange[];
    }>;
    processAndPostComments(allComments: ReviewComment[], totalTokens: TokenUsage, modifiedFiles: string[], pr: PullRequest, triggeringUser: User, fileChanges: FileChange[]): Promise<void>;
    reportCosts(totalTokens: TokenUsage): Promise<void>;
}
//# sourceMappingURL=workflow.d.ts.map