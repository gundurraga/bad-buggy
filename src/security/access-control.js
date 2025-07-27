const core = require("@actions/core");

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
      const { data: collaborator } =
        await octokit.rest.repos.getCollaboratorPermissionLevel({
          owner: context.repo.owner,
          repo: context.repo.repo,
          username: triggeringUser,
        });
      hasWriteAccess = ["admin", "write"].includes(collaborator.permission);
    } catch (error) {
      // Differentiate between user not found vs API failure
      if (error.status === 404) {
        // User is not a collaborator - this is expected
        hasWriteAccess = false;
      } else {
        // API failure (rate limit, network, etc.) - security risk
        core.error(`GitHub API permission check failed: ${error.message}`);
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
    else if (
      config.allowed_users_env &&
      process.env[config.allowed_users_env]
    ) {
      allowedUsers = process.env[config.allowed_users_env]
        .split(",")
        .map((u) => u.trim());
      core.info(
        `Using environment-based allowlist: ${allowedUsers.length} users`
      );
    }

    const isInAllowlist =
      allowedUsers.length > 0 ? allowedUsers.includes(triggeringUser) : true; // No allowlist = allow all collaborators

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

    const workflowFileModified = files.some(
      (file) =>
        file.filename.startsWith(".github/workflows/") ||
        file.filename.includes("action.yml") ||
        file.filename.includes("action.yaml")
    );

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
  } catch (error) {
    core.error(`Security check failed: ${error.message}`);
    return {
      allowed: false,
      reason: `Security check error: ${error.message}`,
      message: `Automated review skipped: Unable to verify user permissions.`,
    };
  }
}

module.exports = {
  performSecurityCheck,
};
