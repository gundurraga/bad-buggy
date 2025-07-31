import { SecurityCheckResult, PullRequest, User, ReviewConfig } from '../types.js';

// Pure function to check if user is repository owner
export const isRepositoryOwner = (user: User, repoOwner: string): boolean => {
  return user.login === repoOwner;
};

// Pure function to check if user is in allowed list
export const isUserAllowed = (user: User, allowedUsers: string[]): boolean => {
  return allowedUsers.length === 0 || allowedUsers.includes(user.login);
};

// Pure function to check if PR is from external fork
export const isExternalFork = (pr: PullRequest, repoOwner: string): boolean => {
  return pr.head.ref.includes(':') || pr.user.login !== repoOwner;
};

// Pure function to check if workflow files are modified
export const hasWorkflowChanges = (files: string[]): boolean => {
  return files.some(file => file.startsWith('.github/workflows/'));
};

// Pure function to perform security validation
export const validateSecurity = (
  pr: PullRequest,
  triggeringUser: User,
  repoOwner: string,
  config: ReviewConfig,
  modifiedFiles: string[] = []
): SecurityCheckResult => {
  const isOwner = isRepositoryOwner(triggeringUser, repoOwner);
  const isExternal = isExternalFork(pr, repoOwner);
  const hasWorkflow = hasWorkflowChanges(modifiedFiles);
  const userAllowed = isUserAllowed(triggeringUser, config.allowed_users);

  // External fork PRs can only be reviewed by repository owner
  if (isExternal && !isOwner) {
    return {
      allowed: false,
      reason: 'external_fork_restriction',
      message: 'AI reviews for external fork PRs can only be triggered by the repository owner for security reasons.'
    };
  }

  // Check explicit allowlist
  if (!userAllowed) {
    return {
      allowed: false,
      reason: 'user_not_allowed',
      message: `User ${triggeringUser.login} is not in the allowed users list.`
    };
  }

  // Workflow file changes require owner permission
  if (hasWorkflow && !isOwner) {
    return {
      allowed: false,
      reason: 'workflow_modification_restriction',
      message: 'AI reviews for PRs modifying workflow files can only be triggered by the repository owner.'
    };
  }

  return { allowed: true };
};