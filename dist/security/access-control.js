"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.performSecurityCheck = performSecurityCheck;
const core = __importStar(require("@actions/core"));
async function performSecurityCheck(octokit, context, pr, config) {
    const triggeringUser = context.actor;
    const prAuthor = pr.user.login;
    const repoOwner = context.repo.owner;
    try {
        // 1. CRITICAL: Check if from external fork (highest risk)
        if (pr.head.repo.full_name !== pr.base.repo.full_name) {
            // External fork - very restrictive
            if (triggeringUser !== repoOwner) {
                return {
                    allowed: false,
                    reason: `External fork PR from ${prAuthor}, triggered by ${triggeringUser} (not repo owner)`,
                    message: `Automated review skipped: External fork PRs can only be reviewed when triggered by repository owner (@${repoOwner}).`,
                };
            }
        }
        // 2. Check repository collaborator permissions
        let hasWriteAccess = false;
        let permissionCheckFailed = false;
        try {
            const { data: collaborator } = await octokit.rest.repos.getCollaboratorPermissionLevel({
                owner: context.repo.owner,
                repo: context.repo.repo,
                username: triggeringUser,
            });
            hasWriteAccess = ['admin', 'write'].includes(collaborator.permission);
        }
        catch (error) {
            // Differentiate between user not found vs API failure
            if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
                // User is not a collaborator - this is expected
                hasWriteAccess = false;
            }
            else {
                // API failure (rate limit, network, etc.) - security risk
                const message = error instanceof Error ? error.message : String(error);
                core.error(`GitHub API permission check failed: ${message}`);
                permissionCheckFailed = true;
                hasWriteAccess = false;
            }
        }
        // Fail securely if we couldn't verify permissions
        if (permissionCheckFailed) {
            return {
                allowed: false,
                reason: `Permission check failed for ${triggeringUser} - cannot verify authorization`,
                message: `Automated review skipped: Unable to verify user permissions due to API error. Please try again later.`,
            };
        }
        // 3. Check explicit allowlist (if configured)
        let allowedUsers = [];
        // Option 1: Static config allowlist
        if (config.allowed_users && config.allowed_users.length > 0) {
            allowedUsers = config.allowed_users;
        }
        // Option 2: Environment-based allowlist (for organizations)
        else if (config.allowed_users_env &&
            process.env[config.allowed_users_env]) {
            const envValue = process.env[config.allowed_users_env];
            if (envValue) {
                allowedUsers = envValue
                    .split(',')
                    .map((u) => u.trim());
            }
            core.info(`Using environment-based allowlist: ${allowedUsers.length} users`);
        }
        const isInAllowlist = allowedUsers.length > 0 ? allowedUsers.includes(triggeringUser) : true; // No allowlist = allow all collaborators
        // 4. Final decision logic
        const isRepoOwner = triggeringUser === repoOwner;
        const isAuthorized = isRepoOwner || (hasWriteAccess && isInAllowlist);
        if (!isAuthorized) {
            return {
                allowed: false,
                reason: `User ${triggeringUser} lacks required permissions (owner: ${isRepoOwner}, write access: ${hasWriteAccess}, allowlisted: ${isInAllowlist})`,
                message: `Automated review skipped: Only repository owner and authorized collaborators can trigger reviews.`,
            };
        }
        // 5. Check for workflow file modifications (security risk)
        const { data: files } = await octokit.rest.pulls.listFiles({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: pr.number,
        });
        const workflowFileModified = files.some((file) => file.filename.startsWith('.github/workflows/') ||
            file.filename.includes('action.yml') ||
            file.filename.includes('action.yaml'));
        if (workflowFileModified && !isRepoOwner) {
            return {
                allowed: false,
                reason: `Workflow files modified by non-owner ${triggeringUser}`,
                message: `Automated review skipped: Workflow file changes can only be reviewed by repository owner for security.`,
            };
        }
        return {
            allowed: true,
            reason: `Authorized: ${triggeringUser} (owner: ${isRepoOwner}, collaborator: ${hasWriteAccess})`,
            message: null,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        core.error(`Security check failed: ${message}`);
        return {
            allowed: false,
            reason: `Security check error: ${message}`,
            message: `Automated review skipped: Unable to verify user permissions.`,
        };
    }
}
//# sourceMappingURL=access-control.js.map