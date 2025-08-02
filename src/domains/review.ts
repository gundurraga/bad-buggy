import { ReviewComment, DiffChunk, FileChange, ReviewConfig, RepositoryContext, IncrementalDiff } from "../types";
import { getFileContent } from '../effects/github-api';
import { getOctokit } from '@actions/github';
import { Context } from '@actions/github/lib/context';

// Pure function to count tokens
export const countTokens = (text: string, model: string): number => {
  let avgCharsPerToken = 3.5; // Default conservative estimate

  // Adjust based on model type (rough estimates)
  if (model.includes("claude")) {
    avgCharsPerToken = 3.8; // Claude tends to have slightly longer tokens
  } else if (model.includes("gpt-4")) {
    avgCharsPerToken = 3.2; // GPT-4 is more efficient
  } else if (model.includes("gpt-3")) {
    avgCharsPerToken = 3.0; // GPT-3 models
  }

  return Math.ceil(text.length / avgCharsPerToken);
};

// Pure function to check if file should be ignored
export const shouldIgnoreFile = (
  filename: string,
  config: ReviewConfig
): boolean => {
  return config.ignore_patterns.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      return regex.test(filename);
    }
    return filename.includes(pattern);
  });
};

// Extract line numbers from diff patch
const extractLineNumbers = (patch: string): { start: number; end: number }[] => {
  const ranges: { start: number; end: number }[] = [];
  const lines = patch.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^@@ -\d+,?\d* \+(\d+),?(\d*) @@/);
    if (match) {
      const start = parseInt(match[1], 10);
      const count = match[2] ? parseInt(match[2], 10) : 1;
      ranges.push({ start, end: start + count - 1 });
    }
  }
  
  return ranges;
};

// Get contextual content (±100 lines around changes)
const getContextualContent = async (
  file: FileChange,
  octokit: ReturnType<typeof getOctokit>,
  context: Context,
  sha: string
): Promise<string | undefined> => {
  if (file.status === 'removed' || !file.patch) {
    return undefined;
  }

  try {
    const fullContent = await getFileContent(octokit, context, file.filename, sha);
    if (!fullContent) return undefined;

    const lines = fullContent.split('\n');
    const ranges = extractLineNumbers(file.patch);
    
    if (ranges.length === 0) return undefined;

    // Calculate the overall range with ±100 lines buffer
    const minLine = Math.max(1, Math.min(...ranges.map(r => r.start)) - 100);
    const maxLine = Math.min(lines.length, Math.max(...ranges.map(r => r.end)) + 100);
    
    // For small files (<200 lines), include the entire file
    if (lines.length <= 200) {
      return fullContent;
    }
    
    // Extract the contextual lines
    const contextualLines = lines.slice(minLine - 1, maxLine);
    return contextualLines.join('\n');
  } catch (error) {
    console.warn(`Could not get contextual content for ${file.filename}: ${error}`);
    return undefined;
  }
};

// Simplified chunking with ±100 lines contextual content
export const chunkDiff = async (
  diff: FileChange[],
  config: ReviewConfig,
  repositoryContext?: RepositoryContext,
  octokit?: ReturnType<typeof getOctokit>,
  context?: Context,
  sha?: string
): Promise<DiffChunk[]> => {
  const chunks: DiffChunk[] = [];
  let currentChunk: DiffChunk = { 
    content: "", 
    fileChanges: [], 
    repositoryContext,
    contextualContent: {}
  };
  const maxChunkSize = 60000;

  // Filter out ignored files first
  const validFiles = diff.filter(file => !shouldIgnoreFile(file.filename, config));

  // Pre-calculate file content with contextual content
  const fileData = [];
  for (const file of validFiles) {
    let content = `\n--- ${file.filename} (${file.status})\n`;
    
    // Get contextual content (±100 lines) if we have the necessary parameters
    if (octokit && context && sha) {
      const contextualContent = await getContextualContent(file, octokit, context, sha);
      if (contextualContent) {
        file.contextualContent = contextualContent;
        content += `\n### Contextual Content (±100 lines around changes):\n\`\`\`\n${contextualContent}\n\`\`\`\n\n`;
      }
    }
    
    // Add diff content
    content += `### Changes:\n${file.patch || ""}\n`;
    
    fileData.push({
      file,
      content,
      size: content.length
    });
  }

  // Sort files by size (smallest first) to optimize packing
  fileData.sort((a, b) => a.size - b.size);

  for (const { file, content, size } of fileData) {
    // If this is the first file or adding it won't exceed the limit, add to current chunk
    if (currentChunk.fileChanges.length === 0 || currentChunk.content.length + size <= maxChunkSize) {
      currentChunk.content += content;
      currentChunk.fileChanges.push(file);
      
      // Add to contextual content if available
      if (file.contextualContent) {
        currentChunk.contextualContent![file.filename] = file.contextualContent;
      }
    } else {
      // Current chunk is full, start a new one
      if (currentChunk.content) {
        chunks.push(currentChunk);
      }
      
      const newContextualContent: Record<string, string> = {};
      if (file.contextualContent) {
        newContextualContent[file.filename] = file.contextualContent;
      }
      
      currentChunk = {
        content: content,
        fileChanges: [file],
        repositoryContext,
        contextualContent: newContextualContent
      };
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.content) {
    chunks.push(currentChunk);
  }

  return chunks;
};



// Process incremental diff for review (always enabled now)
export const processIncrementalDiff = (
  incrementalDiff: IncrementalDiff
): { shouldReview: boolean; message?: string } => {
  if (incrementalDiff.newCommits.length === 0) {
    return {
      shouldReview: false,
      message: '🔄 **Incremental Review**: No new commits to review since last review.'
    };
  }

  if (incrementalDiff.changedFiles.length === 0) {
    return {
      shouldReview: false,
      message: `🔄 **Incremental Review**: ${incrementalDiff.newCommits.length} new commit(s) found, but no file changes to review.`
    };
  }

  const message = incrementalDiff.isIncremental
    ? `🔄 **Incremental Review**: Reviewing ${incrementalDiff.newCommits.length} new commit(s) with ${incrementalDiff.changedFiles.length} files to review.`
    : `🆕 **Initial Review**: Reviewing all ${incrementalDiff.changedFiles.length} files to review in this PR.`;

  return {
    shouldReview: true,
    message
  };
};

// Pure function to process and sort comments
export const processComments = (
  comments: ReviewComment[],
  config: ReviewConfig
): ReviewComment[] => {
  // Parse and sort comments
  const sortedComments = [...comments];

  // Always prioritize by severity (critical > major > suggestion)
  const severityOrder = { critical: 0, major: 1, suggestion: 2 };
  sortedComments.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  // Limit to max_comments
  return sortedComments.slice(0, config.max_comments);
};
