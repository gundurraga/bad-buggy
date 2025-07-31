import { SecurityCheckResult, PullRequest, User, ReviewConfig } from '../types.js';
export declare const isRepositoryOwner: (user: User, repoOwner: string) => boolean;
export declare const isUserAllowed: (user: User, allowedUsers: string[]) => boolean;
export declare const isExternalFork: (pr: PullRequest, _repoOwner: string) => boolean;
export declare const hasWorkflowChanges: (files: string[]) => boolean;
export declare const validateSecurity: (pr: PullRequest, triggeringUser: User, repoOwner: string, config: ReviewConfig, modifiedFiles?: string[]) => SecurityCheckResult;
//# sourceMappingURL=security.d.ts.map