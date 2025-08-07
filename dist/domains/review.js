"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processComments = exports.processIncrementalDiff = exports.chunkDiff = exports.shouldIgnoreFile = exports.countTokens = void 0;
const github_api_1 = require("../effects/github-api");
// Pure function to count tokens
const countTokens = (text, model) => {
    let avgCharsPerToken = 3.5; // Default conservative estimate
    // Adjust based on model type (rough estimates)
    if (model.includes("claude")) {
        avgCharsPerToken = 3.8; // Claude tends to have slightly longer tokens
    }
    else if (model.includes("gpt-4")) {
        avgCharsPerToken = 3.2; // GPT-4 is more efficient
    }
    else if (model.includes("gpt-3")) {
        avgCharsPerToken = 3.0; // GPT-3 models
    }
    return Math.ceil(text.length / avgCharsPerToken);
};
exports.countTokens = countTokens;
// Pure function to check if file should be ignored
const shouldIgnoreFile = (filename, config) => {
    return config.ignore_patterns.some((pattern) => {
        if (pattern.includes("*")) {
            const regex = new RegExp(pattern.replace(/\*/g, ".*"));
            return regex.test(filename);
        }
        return filename.includes(pattern);
    });
};
exports.shouldIgnoreFile = shouldIgnoreFile;
// Extract line numbers from diff patch
const extractLineNumbers = (patch) => {
    const ranges = [];
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
// Helper function to expand context to include complete function/class boundaries
const expandToFunctionBoundaries = (lines, minLine, maxLine, filename) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    // Language-specific patterns for function/class boundaries
    const patterns = {
        ts: [/^\s*(export\s+)?(async\s+)?function\s+\w+/, /^\s*(export\s+)?class\s+\w+/, /^\s*(export\s+)?interface\s+\w+/, /^\s*(export\s+)?type\s+\w+/],
        js: [/^\s*(export\s+)?(async\s+)?function\s+\w+/, /^\s*(export\s+)?class\s+\w+/],
        py: [/^\s*(async\s+)?def\s+\w+/, /^\s*class\s+\w+/],
        go: [/^\s*func\s+(\w+\s+)?\w+/, /^\s*type\s+\w+/],
        java: [/^\s*(public|private|protected)?\s*(static\s+)?[\w<>[\]]+\s+\w+\s*\(/, /^\s*(public|private|protected)?\s*(abstract\s+|final\s+)?(class|interface)\s+\w+/],
        default: [/^\s*[\w\s]*function\s*\w*/, /^\s*[\w\s]*class\s*\w*/]
    };
    const functionPatterns = patterns[ext] || patterns.default;
    let expandedStart = minLine;
    let expandedEnd = maxLine;
    // Look backwards for function start
    for (let i = minLine - 1; i >= Math.max(0, minLine - 50); i--) {
        const line = lines[i];
        if (functionPatterns.some(pattern => pattern.test(line))) {
            expandedStart = i + 1;
            break;
        }
    }
    // Look forwards for function end (closing braces, dedentation)
    let braceCount = 0;
    let baseIndent = -1;
    for (let i = expandedStart - 1; i < Math.min(lines.length, maxLine + 50); i++) {
        const line = lines[i];
        if (baseIndent === -1 && line.trim()) {
            baseIndent = line.search(/\S/);
        }
        // Count braces for languages that use them
        if (['ts', 'js', 'java', 'go'].includes(ext)) {
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            if (braceCount === 0 && i > minLine && line.includes('}')) {
                expandedEnd = Math.min(i + 2, lines.length);
                break;
            }
        }
        // For Python, use indentation
        else if (ext === 'py') {
            if (line.trim() && baseIndent !== -1 && line.search(/\S/) <= baseIndent && i > minLine) {
                expandedEnd = i;
                break;
            }
        }
    }
    return { start: expandedStart, end: expandedEnd };
};
// Get enhanced contextual content (±150 lines with function boundaries)
const getContextualContent = async (file, octokit, context, sha) => {
    if (file.status === 'removed' || !file.patch) {
        return undefined;
    }
    try {
        const fullContent = await (0, github_api_1.getFileContent)(octokit, context, file.filename, sha);
        if (!fullContent)
            return undefined;
        const lines = fullContent.split('\n');
        const ranges = extractLineNumbers(file.patch);
        if (ranges.length === 0)
            return undefined;
        // Enhanced contextual content: ±150 lines with function boundaries
        const minLine = Math.max(1, Math.min(...ranges.map(r => r.start)) - 150);
        const maxLine = Math.min(lines.length, Math.max(...ranges.map(r => r.end)) + 150);
        // For small files (<300 lines), include the entire file
        if (lines.length <= 300) {
            return fullContent;
        }
        // Try to include complete function/class boundaries for better context
        const adjustedRange = expandToFunctionBoundaries(lines, minLine, maxLine, file.filename);
        // Extract the contextual lines with line numbers for better reference
        const contextualLines = lines.slice(adjustedRange.start - 1, adjustedRange.end);
        const numberedLines = contextualLines.map((line, index) => `${adjustedRange.start + index}: ${line}`);
        return numberedLines.join('\n');
    }
    catch (error) {
        console.warn(`Could not get contextual content for ${file.filename}: ${error}`);
        return undefined;
    }
};
// Simplified chunking with ±100 lines contextual content
const chunkDiff = async (diff, config, repositoryContext, octokit, context, sha) => {
    const chunks = [];
    let currentChunk = {
        content: "",
        fileChanges: [],
        repositoryContext,
        contextualContent: {}
    };
    const maxChunkSize = 60000;
    // Filter out ignored files first
    const validFiles = diff.filter(file => !(0, exports.shouldIgnoreFile)(file.filename, config));
    // Pre-calculate file content with contextual content
    const fileData = [];
    for (const file of validFiles) {
        let content = `\n--- ${file.filename} (${file.status})\n`;
        // Get contextual content (±100 lines) if we have the necessary parameters
        if (octokit && context && sha) {
            const contextualContent = await getContextualContent(file, octokit, context, sha);
            if (contextualContent) {
                file.contextualContent = contextualContent;
                content += `\n### Contextual Content (±150 lines with function boundaries):\n\`\`\`\n${contextualContent}\n\`\`\`\n\n`;
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
                currentChunk.contextualContent[file.filename] = file.contextualContent;
            }
        }
        else {
            // Current chunk is full, start a new one
            if (currentChunk.content) {
                chunks.push(currentChunk);
            }
            const newContextualContent = {};
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
exports.chunkDiff = chunkDiff;
// Process incremental diff for review (always enabled now)
const processIncrementalDiff = (incrementalDiff, config) => {
    if (incrementalDiff.newCommits.length === 0) {
        return {
            shouldReview: false,
            message: '🔄 **Incremental Review**: No new commits to review since last review.'
        };
    }
    // Filter out ignored files before counting
    const filesToReview = incrementalDiff.changedFiles.filter(file => !(0, exports.shouldIgnoreFile)(file.filename, config));
    if (filesToReview.length === 0) {
        return {
            shouldReview: false,
            message: `🔄 **Incremental Review**: ${incrementalDiff.newCommits.length} new commit(s) found, but no file changes to review after applying ignore patterns.`
        };
    }
    const message = incrementalDiff.isIncremental
        ? `🔄 **Incremental Review**: Reviewing ${incrementalDiff.newCommits.length} new commit(s) with ${filesToReview.length} files to review.`
        : `🆕 **Initial Review**: Reviewing ${filesToReview.length} files to review in this PR.`;
    return {
        shouldReview: true,
        message
    };
};
exports.processIncrementalDiff = processIncrementalDiff;
// Pure function to process and sort comments
const processComments = (comments, _config) => {
    // Return comments as-is since we no longer use severity
    return comments;
};
exports.processComments = processComments;
//# sourceMappingURL=review.js.map