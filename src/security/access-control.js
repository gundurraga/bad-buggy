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
    try {
      const { data: collaborator } =
        await octokit.rest.repos.getCollaboratorPermissionLevel({
          owner: context.repo.owner,
          repo: context.repo.repo,
          username: triggeringUser,
        });
      hasWriteAccess = ["admin", "write"].includes(collaborator.permission);
    } catch (error) {
      // User is not a collaborator
      hasWriteAccess = false;
    }

    // 3. Check explicit allowlist (if configured)
    const isInAllowlist =
      config.allowed_users && config.allowed_users.length > 0
        ? config.allowed_users.includes(triggeringUser)
        : true; // No allowlist = allow all collaborators

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
