import { getOctokit } from "@actions/github";
import { Context } from "@actions/github/lib/context";
import {
  FileChange,
  ReviewComment,
  PullRequest,
  ReviewState,
  IncrementalDiff,
  RepositoryContext,
  RepositoryStructure,
  FileInfo,
  PackageInfo,
} from "../types";
import { Logger } from "../services/logger";
import { REVIEW_CONSTANTS } from "../constants";
import * as path from "path";

// Effect: Get PR diff from GitHub API
export const getPRDiff = async (
  octokit: ReturnType<typeof getOctokit>,
  context: Context,
  pr: PullRequest
): Promise<FileChange[]> => {
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pr.number,
    per_page: REVIEW_CONSTANTS.MAX_FILES_PER_REQUEST,
  });

  return files.map((file) => ({
    filename: file.filename,
    status: file.status as "added" | "modified" | "removed",
    additions: file.additions || 0,
    deletions: file.deletions || 0,
    changes: file.changes || 0,
    patch: file.patch,
  }));
};

// Effect: Check user permissions
export const checkUserPermissions = async (
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
  username: string
): Promise<string> => {
  try {
    const { data } = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username,
    });
    return data.permission;
  } catch (error) {
    return "none";
  }
};

// Effect: Post review to GitHub
// Helper function to extract valid line numbers from patch
const getValidLinesFromPatch = (patch: string): Set<number> => {
  const validLines = new Set<number>();
  if (!patch) return validLines;

  const lines = patch.split("\n");
  let currentLine = 0;

  for (const line of lines) {
    // Parse hunk headers like @@ -1,4 +1,6 @@
    const hunkMatch = line.match(/^@@ -\d+,?\d* \+(\d+),?\d* @@/);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1], 10);
      continue;
    }

    // Skip context lines (start with space) and deleted lines (start with -)
    if (line.startsWith(" ") || line.startsWith("+")) {
      if (currentLine > 0) {
        validLines.add(currentLine);
      }
    }

    // Increment line number for context and added lines
    if (line.startsWith(" ") || line.startsWith("+")) {
      currentLine++;
    }
  }

  return validLines;
};

// Helper function to validate comments against diff
const validateCommentsAgainstDiff = (
  comments: ReviewComment[],
  fileChanges: FileChange[]
): ReviewComment[] => {
  const fileValidLines = new Map<string, Set<number>>();

  // Build map of valid lines for each file
  for (const file of fileChanges) {
    if (file.patch) {
      fileValidLines.set(file.filename, getValidLinesFromPatch(file.patch));
    }
  }

  // Filter comments to only include those on valid lines
  return comments.filter((comment) => {
    // File-level comments don't need line validation
    if (comment.line === undefined || comment.commentType === "file") {
      // Just check if the file exists in the changes
      return fileChanges.some((file) => file.filename === comment.path);
    }

    // Diff comments need line validation
    const validLines = fileValidLines.get(comment.path);
    if (!validLines || validLines.size === 0) {
      return false; // No valid lines for this file
    }
    return validLines.has(comment.line);
  });
};

export const postReview = async (
  octokit: ReturnType<typeof getOctokit>,
  context: Context,
  pr: PullRequest,
  comments: ReviewComment[],
  body: string,
  fileChanges?: FileChange[]
): Promise<void> => {
  let validatedComments = comments;

  // Validate comments against diff if file changes are provided
  if (fileChanges) {
    validatedComments = validateCommentsAgainstDiff(comments, fileChanges);

    if (validatedComments.length < comments.length) {
      const filteredCount = comments.length - validatedComments.length;
      const filteredComments = comments.filter(
        (c) => !validatedComments.includes(c)
      );
      Logger.commentFiltering(
        filteredCount,
        filteredComments.map((c) => `${c.path}:${c.line}`)
      );
    }
  }

  // Separate file-level comments from diff comments
  const diffComments = validatedComments.filter(
    (comment) => comment.line !== undefined || comment.start_line !== undefined
  );
  const fileComments = validatedComments.filter(
    (comment) => comment.line === undefined && comment.start_line === undefined
  );

  const reviewComments = diffComments.map((comment) => {
    const baseComment = {
      path: comment.path,
      body: comment.body,
    };

    // Handle multi-line comments (GitHub API format: start_line + line)
    if (comment.start_line !== undefined && comment.line !== undefined) {
      return {
        ...baseComment,
        start_line: comment.start_line,
        line: comment.line, // This is the end line in GitHub's API
      };
    }

    // Handle single-line diff comments
    if (comment.line !== undefined) {
      return {
        ...baseComment,
        line: comment.line,
      };
    }

    return baseComment;
  });

  // Post diff-level review with comments
  if (reviewComments.length > 0) {
    await octokit.rest.pulls.createReview({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pr.number,
      body: body,
      event: "COMMENT",
      comments: reviewComments,
    });
  } else {
    // If no diff comments, post the body as a general review
    await octokit.rest.pulls.createReview({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pr.number,
      body: body,
      event: "COMMENT",
    });
  }

  // Post file-level comments as separate issue comments
  for (const fileComment of fileComments) {
    const fileCommentBody = `**📁 File: \`${fileComment.path}\`**\n\n${fileComment.body}`;
    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: pr.number, // PR numbers are also issue numbers
      body: fileCommentBody,
    });
  }
};

// Effect: Get commits for incremental review
export const getPRCommits = async (
  octokit: ReturnType<typeof getOctokit>,
  context: Context,
  pr: PullRequest
): Promise<string[]> => {
  const { data: commits } = await octokit.rest.pulls.listCommits({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pr.number,
    per_page: REVIEW_CONSTANTS.MAX_FILES_PER_REQUEST,
  });

  return commits.map((commit) => commit.sha);
};

// Effect: Get review state from GitHub comments
export const getReviewState = async (
  octokit: ReturnType<typeof getOctokit>,
  context: Context,
  pr: PullRequest
): Promise<ReviewState | null> => {
  try {
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: pr.number,
    });

    // Look for our review state comment
    const stateComment = comments.find(
      (comment) =>
        comment.body?.includes("<!-- BAD_BUGGY_REVIEW_STATE:") &&
        comment.user?.login === "github-actions[bot]"
    );

    if (stateComment) {
      const stateMatch = stateComment.body?.match(
        /<!-- BAD_BUGGY_REVIEW_STATE:(.+?)-->/s
      );
      if (stateMatch) {
        return JSON.parse(stateMatch[1]);
      }
    }

    return null;
  } catch (error) {
    Logger.error(`Failed to get review state: ${error}`);
    return null;
  }
};

// Effect: Save review state to GitHub comments
export const saveReviewState = async (
  octokit: ReturnType<typeof getOctokit>,
  context: Context,
  pr: PullRequest,
  state: ReviewState
): Promise<void> => {
  try {
    const stateJson = JSON.stringify(state);
    const commentBody = `<!-- BAD_BUGGY_REVIEW_STATE:${stateJson}-->

🤖 **Bad Buggy Review State Updated**

Last reviewed commit: \`${state.lastReviewedSha.substring(0, 7)}\`
Reviewed commits: ${state.reviewedCommits.length}
Timestamp: ${state.timestamp}`;

    // Check if we already have a state comment
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: pr.number,
    });

    const existingStateComment = comments.find(
      (comment) =>
        comment.body?.includes("<!-- BAD_BUGGY_REVIEW_STATE:") &&
        comment.user?.login === "github-actions[bot]"
    );

    if (existingStateComment) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: existingStateComment.id,
        body: commentBody,
      });
    } else {
      // Create new comment
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: pr.number,
        body: commentBody,
      });
    }
  } catch (error) {
    Logger.error(`Failed to save review state: ${error}`);
  }
};

// Effect: Get incremental diff (only new commits)
export const getIncrementalDiff = async (
  octokit: ReturnType<typeof getOctokit>,
  context: Context,
  pr: PullRequest,
  lastReviewedSha?: string
): Promise<IncrementalDiff> => {
  const allCommits = await getPRCommits(octokit, context, pr);

  if (!lastReviewedSha) {
    // First review - get all changes
    const fileChanges = await getPRDiff(octokit, context, pr);
    return {
      newCommits: allCommits,
      changedFiles: fileChanges,
      isIncremental: false,
    };
  }

  // Find new commits since last review
  const lastReviewedIndex = allCommits.indexOf(lastReviewedSha);
  const newCommits =
    lastReviewedIndex >= 0
      ? allCommits.slice(lastReviewedIndex + 1)
      : allCommits; // If we can't find the last reviewed commit, review all

  if (newCommits.length === 0) {
    return {
      newCommits: [],
      changedFiles: [],
      isIncremental: true,
    };
  }

  // Get diff for new commits only
  const { data: comparison } = await octokit.rest.repos.compareCommits({
    owner: context.repo.owner,
    repo: context.repo.repo,
    base: lastReviewedSha,
    head: pr.head.sha,
  });

  const changedFiles: FileChange[] =
    comparison.files?.map((file) => ({
      filename: file.filename,
      status: file.status as "added" | "modified" | "removed",
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      changes: file.changes || 0,
      patch: file.patch,
    })) || [];

  return {
    newCommits,
    changedFiles,
    isIncremental: true,
  };
};

// Effect: Get repository structure
export const getRepositoryStructure = async (
  octokit: ReturnType<typeof getOctokit>,
  context: Context,
  pr: PullRequest
): Promise<RepositoryStructure> => {
  try {
    const { data: tree } = await octokit.rest.git.getTree({
      owner: context.repo.owner,
      repo: context.repo.repo,
      tree_sha: pr.head.sha,
      recursive: "true",
    });

    const files: FileInfo[] = [];
    const directories: string[] = [];
    const languages: Record<string, number> = {};

    tree.tree.forEach((item) => {
      if (item.type === "tree") {
        directories.push(item.path || "");
      } else if (item.type === "blob") {
        const extension = path.extname(item.path || "").toLowerCase();
        const fileInfo: FileInfo = {
          path: item.path || "",
          type: "file",
          extension: extension || undefined,
          size: item.size,
        };
        files.push(fileInfo);

        // Count languages by extension
        if (extension) {
          languages[extension] = (languages[extension] || 0) + 1;
        }
      }
    });

    return {
      directories: directories.sort(),
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
      totalFiles: files.length,
      languages,
    };
  } catch (error) {
    Logger.error(`Failed to get repository structure: ${error}`);
    return {
      directories: [],
      files: [],
      totalFiles: 0,
      languages: {},
    };
  }
};

// Effect: Get file content from GitHub
export const getFileContent = async (
  octokit: ReturnType<typeof getOctokit>,
  context: Context,
  filePath: string,
  sha: string
): Promise<string | null> => {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: context.repo.owner,
      repo: context.repo.repo,
      path: filePath,
      ref: sha,
    });

    if ("content" in data && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch (error) {
    Logger.error(`Failed to get file content for ${filePath}: ${error}`);
    return null;
  }
};

// Effect: Get package.json info
export const getPackageInfo = async (
  octokit: ReturnType<typeof getOctokit>,
  context: Context,
  sha: string
): Promise<PackageInfo | null> => {
  try {
    const packageContent = await getFileContent(
      octokit,
      context,
      "package.json",
      sha
    );
    if (packageContent) {
      return JSON.parse(packageContent);
    }
    return null;
  } catch (error) {
    // Silently handle missing package.json - it's normal for non-Node.js projects
    return null;
  }
};

// Effect: Get existing PR review comments
export const getExistingReviewComments = async (
  octokit: ReturnType<typeof getOctokit>,
  context: Context,
  pr: PullRequest
): Promise<string[]> => {
  try {
    // Get review comments (line-specific comments)
    const { data: reviewComments } =
      await octokit.rest.pulls.listReviewComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: pr.number,
      });

    // Get general issue comments
    const { data: issueComments } = await octokit.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: pr.number,
    });

    // Combine and filter AI review comments, excluding state tracking comments
    const existingComments: string[] = [];

    reviewComments.forEach((comment) => {
      if (
        comment.user?.login === "github-actions[bot]" &&
        !comment.body?.includes("BAD_BUGGY_REVIEW_STATE")
      ) {
        existingComments.push(comment.body || "");
      }
    });

    issueComments.forEach((comment) => {
      if (
        comment.user?.login === "github-actions[bot]" &&
        !comment.body?.includes("BAD_BUGGY_REVIEW_STATE")
      ) {
        existingComments.push(comment.body || "");
      }
    });

    return existingComments.filter((comment) => comment.trim().length > 0);
  } catch (error) {
    Logger.error(`Failed to get existing review comments: ${error}`);
    return [];
  }
};

// Effect: Get repository context (simplified)
export const getRepositoryContext = async (
  octokit: ReturnType<typeof getOctokit>,
  context: Context,
  pr: PullRequest
): Promise<RepositoryContext> => {
  const structure = await getRepositoryStructure(octokit, context, pr);
  const packageInfo = await getPackageInfo(octokit, context, pr.head.sha);

  return {
    structure,
    packageInfo: packageInfo || undefined,
  };
};
