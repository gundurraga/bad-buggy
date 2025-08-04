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
exports.getRepositoryContext = exports.getPackageInfo = exports.getFileContent = exports.getRepositoryStructure = exports.getIncrementalDiff = exports.saveReviewState = exports.getReviewState = exports.getPRCommits = exports.postReview = exports.checkUserPermissions = exports.getPRDiff = void 0;
const logger_1 = require("../services/logger");
const path = __importStar(require("path"));
// Effect: Get PR diff from GitHub API
const getPRDiff = async (octokit, context, pr) => {
    const { data: files } = await octokit.rest.pulls.listFiles({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: pr.number,
        per_page: 100,
    });
    return files.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions || 0,
        deletions: file.deletions || 0,
        changes: file.changes || 0,
        patch: file.patch,
    }));
};
exports.getPRDiff = getPRDiff;
// Effect: Check user permissions
const checkUserPermissions = async (octokit, owner, repo, username) => {
    try {
        const { data } = await octokit.rest.repos.getCollaboratorPermissionLevel({
            owner,
            repo,
            username,
        });
        return data.permission;
    }
    catch (error) {
        return "none";
    }
};
exports.checkUserPermissions = checkUserPermissions;
// Effect: Post review to GitHub
// Helper function to extract valid line numbers from patch
const getValidLinesFromPatch = (patch) => {
    const validLines = new Set();
    if (!patch)
        return validLines;
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
const validateCommentsAgainstDiff = (comments, fileChanges) => {
    const fileValidLines = new Map();
    // Build map of valid lines for each file
    for (const file of fileChanges) {
        if (file.patch) {
            fileValidLines.set(file.filename, getValidLinesFromPatch(file.patch));
        }
    }
    // Filter comments to only include those on valid lines
    return comments.filter((comment) => {
        // File-level comments don't need line validation
        if (comment.line === undefined || comment.commentType === 'file') {
            // Just check if the file exists in the changes
            return fileChanges.some(file => file.filename === comment.path);
        }
        // Diff comments need line validation
        const validLines = fileValidLines.get(comment.path);
        if (!validLines || validLines.size === 0) {
            return false; // No valid lines for this file
        }
        return validLines.has(comment.line);
    });
};
const postReview = async (octokit, context, pr, comments, body, fileChanges) => {
    let validatedComments = comments;
    // Validate comments against diff if file changes are provided
    if (fileChanges) {
        validatedComments = validateCommentsAgainstDiff(comments, fileChanges);
        if (validatedComments.length < comments.length) {
            const filteredCount = comments.length - validatedComments.length;
            const filteredComments = comments.filter((c) => !validatedComments.includes(c));
            logger_1.Logger.commentFiltering(filteredCount, filteredComments.map((c) => `${c.path}:${c.line}`));
        }
    }
    const reviewComments = validatedComments.map((comment) => {
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
        // File-level comment without line
        return baseComment;
    });
    await octokit.rest.pulls.createReview({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: pr.number,
        body: body,
        event: "COMMENT",
        comments: reviewComments,
    });
};
exports.postReview = postReview;
// Effect: Get commits for incremental review
const getPRCommits = async (octokit, context, pr) => {
    const { data: commits } = await octokit.rest.pulls.listCommits({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: pr.number,
        per_page: 100,
    });
    return commits.map((commit) => commit.sha);
};
exports.getPRCommits = getPRCommits;
// Effect: Get review state from GitHub comments
const getReviewState = async (octokit, context, pr) => {
    try {
        const { data: comments } = await octokit.rest.issues.listComments({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: pr.number,
        });
        // Look for our review state comment
        const stateComment = comments.find((comment) => comment.body?.includes("<!-- BAD_BUGGY_REVIEW_STATE:") &&
            comment.user?.login === "github-actions[bot]");
        if (stateComment) {
            const stateMatch = stateComment.body?.match(/<!-- BAD_BUGGY_REVIEW_STATE:(.+?)-->/s);
            if (stateMatch) {
                return JSON.parse(stateMatch[1]);
            }
        }
        return null;
    }
    catch (error) {
        logger_1.Logger.error(`Failed to get review state: ${error}`);
        return null;
    }
};
exports.getReviewState = getReviewState;
// Effect: Save review state to GitHub comments
const saveReviewState = async (octokit, context, pr, state) => {
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
        const existingStateComment = comments.find((comment) => comment.body?.includes("<!-- BAD_BUGGY_REVIEW_STATE:") &&
            comment.user?.login === "github-actions[bot]");
        if (existingStateComment) {
            // Update existing comment
            await octokit.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: existingStateComment.id,
                body: commentBody,
            });
        }
        else {
            // Create new comment
            await octokit.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: pr.number,
                body: commentBody,
            });
        }
    }
    catch (error) {
        logger_1.Logger.error(`Failed to save review state: ${error}`);
    }
};
exports.saveReviewState = saveReviewState;
// Effect: Get incremental diff (only new commits)
const getIncrementalDiff = async (octokit, context, pr, lastReviewedSha) => {
    const allCommits = await (0, exports.getPRCommits)(octokit, context, pr);
    if (!lastReviewedSha) {
        // First review - get all changes
        const fileChanges = await (0, exports.getPRDiff)(octokit, context, pr);
        return {
            newCommits: allCommits,
            changedFiles: fileChanges,
            isIncremental: false,
        };
    }
    // Find new commits since last review
    const lastReviewedIndex = allCommits.indexOf(lastReviewedSha);
    const newCommits = lastReviewedIndex >= 0
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
    const changedFiles = comparison.files?.map((file) => ({
        filename: file.filename,
        status: file.status,
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
exports.getIncrementalDiff = getIncrementalDiff;
// Effect: Get repository structure
const getRepositoryStructure = async (octokit, context, pr) => {
    try {
        const { data: tree } = await octokit.rest.git.getTree({
            owner: context.repo.owner,
            repo: context.repo.repo,
            tree_sha: pr.head.sha,
            recursive: "true",
        });
        const files = [];
        const directories = [];
        const languages = {};
        tree.tree.forEach((item) => {
            if (item.type === "tree") {
                directories.push(item.path || "");
            }
            else if (item.type === "blob") {
                const extension = path.extname(item.path || "").toLowerCase();
                const fileInfo = {
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
    }
    catch (error) {
        logger_1.Logger.error(`Failed to get repository structure: ${error}`);
        return {
            directories: [],
            files: [],
            totalFiles: 0,
            languages: {},
        };
    }
};
exports.getRepositoryStructure = getRepositoryStructure;
// Effect: Get file content from GitHub
const getFileContent = async (octokit, context, filePath, sha) => {
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
    }
    catch (error) {
        logger_1.Logger.error(`Failed to get file content for ${filePath}: ${error}`);
        return null;
    }
};
exports.getFileContent = getFileContent;
// Effect: Get package.json info
const getPackageInfo = async (octokit, context, sha) => {
    try {
        const packageContent = await (0, exports.getFileContent)(octokit, context, "package.json", sha);
        if (packageContent) {
            return JSON.parse(packageContent);
        }
        return null;
    }
    catch (error) {
        logger_1.Logger.error(`Failed to get package.json: ${error}`);
        return null;
    }
};
exports.getPackageInfo = getPackageInfo;
// Effect: Get repository context (simplified)
const getRepositoryContext = async (octokit, context, pr) => {
    const structure = await (0, exports.getRepositoryStructure)(octokit, context, pr);
    const packageInfo = await (0, exports.getPackageInfo)(octokit, context, pr.head.sha);
    return {
        structure,
        packageInfo: packageInfo || undefined,
    };
};
exports.getRepositoryContext = getRepositoryContext;
//# sourceMappingURL=github-api.js.map