"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSecurity = exports.hasWorkflowChanges = exports.isExternalFork = exports.isUserAllowed = exports.isRepositoryOwner = void 0;
// Pure function to check if user is repository owner
const isRepositoryOwner = (user, repoOwner) => {
    return user.login === repoOwner;
};
exports.isRepositoryOwner = isRepositoryOwner;
// Pure function to check if user is in allowed list
const isUserAllowed = (user, allowedUsers) => {
    return allowedUsers.length === 0 || allowedUsers.includes(user.login);
};
exports.isUserAllowed = isUserAllowed;
// Pure function to check if PR is from external fork
const isExternalFork = (pr, _repoOwner) => {
    return pr.head.repo.full_name !== pr.base.repo.full_name;
};
exports.isExternalFork = isExternalFork;
// Pure function to check if workflow files are modified
const hasWorkflowChanges = (files) => {
    return files.some(file => file.startsWith('.github/workflows/'));
};
exports.hasWorkflowChanges = hasWorkflowChanges;
// Pure function to perform security validation
const validateSecurity = (pr, triggeringUser, repoOwner, config, modifiedFiles = []) => {
    const isOwner = (0, exports.isRepositoryOwner)(triggeringUser, repoOwner);
    const isExternal = (0, exports.isExternalFork)(pr, repoOwner);
    const hasWorkflow = (0, exports.hasWorkflowChanges)(modifiedFiles);
    const userAllowed = (0, exports.isUserAllowed)(triggeringUser, config.allowed_users);
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
exports.validateSecurity = validateSecurity;
//# sourceMappingURL=security.js.map