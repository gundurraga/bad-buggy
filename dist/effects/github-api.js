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
const postReview = async (octokit, context, pr, comments, body) => {
    const reviewComments = comments.map(comment => ({
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