"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postReview = exports.checkUserPermissions = exports.getPRDiff = void 0;
// Effect: Get PR diff from GitHub API
const getPRDiff = async (octokit, context, pr) => {
    const { data: files } = await octokit.rest.pulls.listFiles({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: pr.number,
        per_page: 100
    });
    return files.map(file => ({
        filename: file.filename,
        status: file.status,
        patch: file.patch
    }));
};
exports.getPRDiff = getPRDiff;
// Effect: Check user permissions
const checkUserPermissions = async (octokit, owner, repo, username) => {
    try {
        const { data } = await octokit.rest.repos.getCollaboratorPermissionLevel({
            owner,
            repo,
            username
        });
        return data.permission;
    }
    catch (error) {
        return 'none';
    }
};
exports.checkUserPermissions = checkUserPermissions;
// Effect: Post review to GitHub
// Helper function to extract valid line numbers from patch
const getValidLinesFromPatch = (patch) => {
    const validLines = new Set();
    if (!patch)
        return validLines;
    const lines = patch.split('\n');
    let currentLine = 0;
    for (const line of lines) {
        // Parse hunk headers like @@ -1,4 +1,6 @@
        const hunkMatch = line.match(/^@@ -\d+,?\d* \+(\d+),?\d* @@/);
        if (hunkMatch) {
            currentLine = parseInt(hunkMatch[1], 10);
            continue;
        }
        // Skip context lines (start with space) and deleted lines (start with -)
        if (line.startsWith(' ') || line.startsWith('+')) {
            if (currentLine > 0) {
                validLines.add(currentLine);
            }
        }
        // Increment line number for context and added lines
        if (line.startsWith(' ') || line.startsWith('+')) {
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
    return comments.filter(comment => {
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
            console.log(`Filtered out ${filteredCount} comments that referenced invalid diff lines`);
        }
    }
    const reviewComments = validatedComments.map(comment => ({
        path: comment.path,
        line: comment.line,
        body: comment.body
    }));
    await octokit.rest.pulls.createReview({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: pr.number,
        body: body,
        event: 'COMMENT',
        comments: reviewComments
    });
};
exports.postReview = postReview;
//# sourceMappingURL=github-api.js.map