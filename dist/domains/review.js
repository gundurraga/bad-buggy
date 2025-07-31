"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processComments = exports.chunkDiff = exports.shouldIgnoreFile = exports.countTokens = void 0;
// Pure function to count tokens
const countTokens = (text, model) => {
    let avgCharsPerToken = 3.5; // Default conservative estimate
    // Adjust based on model type (rough estimates)
    if (model.includes('claude')) {
        avgCharsPerToken = 3.8; // Claude tends to have slightly longer tokens
    }
    else if (model.includes('gpt-4')) {
        avgCharsPerToken = 3.2; // GPT-4 is more efficient
    }
    else if (model.includes('gpt-3')) {
        avgCharsPerToken = 3.0; // GPT-3 models
    }
    return Math.ceil(text.length / avgCharsPerToken);
};
exports.countTokens = countTokens;
// Pure function to check if file should be ignored
const shouldIgnoreFile = (filename, config) => {
    return config.ignore_patterns.some(pattern => {
        if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(filename);
        }
        return filename.includes(pattern);
    });
};
exports.shouldIgnoreFile = shouldIgnoreFile;
// Pure function to chunk diff content
const chunkDiff = (diff, config) => {
    const chunks = [];
    let currentChunk = { content: '', files: [], size: 0 };
    const maxChunkSize = 8000; // Conservative limit for API calls
    for (const file of diff) {
        if ((0, exports.shouldIgnoreFile)(file.filename, config)) {
            continue;
        }
        const fileContent = `\n--- ${file.filename} (${file.status})\n${file.patch || ''}\n`;
        const fileSize = fileContent.length;
        // If adding this file would exceed chunk size, start a new chunk
        if (currentChunk.size + fileSize > maxChunkSize && currentChunk.content) {
            chunks.push(currentChunk);
            currentChunk = { content: '', files: [], size: 0 };
        }
        currentChunk.content += fileContent;
        currentChunk.files.push(file.filename);
        currentChunk.size += fileSize;
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
        const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 };
        sortedComments.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    }
    // Limit to max_comments
    return sortedComments.slice(0, config.max_comments);
};
exports.processComments = processComments;
//# sourceMappingURL=review.js.map