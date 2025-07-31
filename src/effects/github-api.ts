import { getOctokit } from '@actions/github';
import { FileChange, ReviewComment, GitHubContext, PullRequest } from '../types';

// Effect: Get PR diff from GitHub API
export const getPRDiff = async (
  octokit: ReturnType<typeof getOctokit>,
  context: any,
  pr: any
): Promise<FileChange[]> => {
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pr.number,
    per_page: 100
  });

  return files.map(file => ({
    filename: file.filename,
    status: file.status as 'added' | 'modified' | 'removed',
    patch: file.patch
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
      username
    });
    return data.permission;
  } catch (error) {
    return 'none';
  }
};

// Effect: Post review to GitHub
export const postReview = async (
  octokit: ReturnType<typeof getOctokit>,
  context: any,
  pr: any,
  comments: ReviewComment[],
  body: string
): Promise<void> => {
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