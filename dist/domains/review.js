"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processComments = exports.chunkDiff = exports.shouldIgnoreFile = exports.countTokens = void 0;
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
// Pure function to chunk diff content
const chunkDiff = (diff, config) => {
    const chunks = [];
    let currentChunk = { content: "", files: [], size: 0 };
    const maxChunkSize = 60000;
    // Filter out ignored files first
    const validFiles = diff.filter(file => !(0, exports.shouldIgnoreFile)(file.filename, config));
    // Pre-calculate file content and sizes for better optimization
    const fileData = validFiles.map(file => {
        const content = `\n--- ${file.filename} (${file.status})\n${file.patch || ""}\n`;
        return {
            file,
            content,
            size: content.length
        };
    });
    // Sort files by size (smallest first) to optimize packing
    fileData.sort((a, b) => a.size - b.size);
    for (const { file, content, size } of fileData) {
        // If this is the first file or adding it won't exceed the limit, add to current chunk
        if (currentChunk.size === 0 || currentChunk.size + size <= maxChunkSize) {
            currentChunk.content += content;
            currentChunk.files.push(file.filename);
            currentChunk.size += size;
        }
        else {
            // Current chunk is full, start a new one
            if (currentChunk.content) {
                chunks.push(currentChunk);
            }
            currentChunk = {
                content: content,
                files: [file.filename],
                size: size
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
// Pure function to process and sort comments
const processComments = (comments, config) => {
    // Parse and sort comments
    const sortedComments = [...comments];
    if (config.prioritize_by_severity) {
        const severityOrder = { critical: 0, major: 1, suggestion: 2 };
        sortedComments.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    }
    // Limit to max_comments
    return sortedComments.slice(0, config.max_comments);
};
exports.processComments = processComments;
//# sourceMappingURL=review.js.map