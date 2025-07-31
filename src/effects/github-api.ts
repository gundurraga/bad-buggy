import { getOctokit } from '@actions/github';
import { Context } from '@actions/github/lib/context';
import { FileChange, ReviewComment, PullRequest } from '../types';

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
// Helper function to extract valid line numbers from patch
const getValidLinesFromPatch = (patch: string): Set<number> => {
  const validLines = new Set<number>();
  if (!patch) return validLines;

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
  return comments.filter(comment => {
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