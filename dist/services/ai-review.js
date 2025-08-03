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
exports.reviewChunk = exports.parseAIResponse = exports.buildReviewPrompt = void 0;
const core = __importStar(require("@actions/core"));
const ai_api_1 = require("../effects/ai-api");
const review_1 = require("../domains/review");
const token_counter_1 = require("./token-counter");
/**
 * Service for handling Bad Buggy-powered code review operations
 */
// Build review prompt with repository context and contextual content
const buildReviewPrompt = (config, chunkContent, repositoryContext) => {
    const basePrompt = config.review_prompt.replace("{{DATE}}", new Date().toISOString().split("T")[0]);
    // Add custom prompt if provided
    const fullPrompt = config.custom_prompt
        ? `${basePrompt}\n\nAdditional instructions: ${config.custom_prompt}`
        : basePrompt;
    let contextSection = "";
    // Always include repository context if available
    if (repositoryContext) {
        contextSection += "\n## Repository Context\n\n";
        // Add project information
        if (repositoryContext.packageInfo) {
            contextSection += `### Project Information\n`;
            contextSection += `- Name: ${repositoryContext.packageInfo.name || "Unknown"}\n`;
            contextSection += `- Version: ${repositoryContext.packageInfo.version || "Unknown"}\n`;
            if (repositoryContext.packageInfo.description) {
                contextSection += `- Description: ${repositoryContext.packageInfo.description}\n`;
            }
            contextSection += "\n";
        }
        // Add repository structure overview
        if (repositoryContext.structure) {
            contextSection += `### Repository Structure\n`;
            contextSection += `- Total Files: ${repositoryContext.structure.totalFiles}\n`;
            const languages = Object.entries(repositoryContext.structure.languages)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([ext, count]) => `${ext} (${count})`)
                .join(", ");
            if (languages) {
                contextSection += `- Main Languages: ${languages}\n`;
            }
            // Add key directories (limit to avoid token overflow)
            const keyDirs = repositoryContext.structure.directories
                .filter((dir) => !dir.includes("node_modules") && !dir.includes(".git"))
                .slice(0, 15)
                .join(", ");
            if (keyDirs) {
                contextSection += `- Key Directories: ${keyDirs}\n`;
            }
            contextSection += "\n";
        }
    }
    return `${fullPrompt}${contextSection}

Please review the following code changes and provide maximum your top 1-5 most impactful insights as a JSON array.

Each comment can be either:
1. **Line-level comment** (specific to diff lines):
   - file: the filename
   - line: the line number (from the diff)  
   - end_line: (optional) the end line for multi-line comments
   - comment: your insight

2. **File-level comment** (general file feedback):
   - file: the filename
   - comment: your insight (omit line/end_line for file-level comments)

Examples of senior engineer feedback with markdown formatting:

[
  {
    "file": "src/auth.js",
    "line": 45,
    "end_line": 65,
    "comment": "**Security vulnerability: SQL injection risk**\n\nYour current approach uses direct string concatenation with user input, which creates a serious security vulnerability that could lead to database compromise.\n\n**Solution**: Use parameterized queries:\n\n\`\`\`sql\n-- Instead of:\nSELECT * FROM users WHERE id = '" + userId + "'\n\n-- Use:\nSELECT * FROM users WHERE id = ?\n\`\`\`\n\nThis follows OWASP guidelines and is a critical security practice that prevents attackers from injecting malicious SQL code."
  },
  {
    "file": "src/payment.js", 
    "line": 78,
    "end_line": 85,
    "comment": "**Great use of the Strategy pattern!**\n\nYour implementation is clean and follows good design principles. One enhancement to consider:\n\n**Add transaction locking** to prevent race conditions during concurrent payment processing:\n\n\`\`\`javascript\nconst lock = await acquirePaymentLock(userId);\ntry {\n  // Your payment processing logic\n} finally {\n  await releaseLock(lock);\n}\n\`\`\`\n\nThis would make the system more robust under high load and prevent double-charging scenarios."
  },
  {
    "file": "src/config.ts",
    "comment": "**Excellent configuration architecture!**\n\nThis file demonstrates good separation of concerns with environment-based configuration. Consider adding:\n\n1. **Configuration validation** using a schema library like Joi or Yup\n2. **Type safety** with strict TypeScript interfaces\n3. **Default fallbacks** for optional configuration values\n\nThis would make the configuration more robust and easier to maintain as the application grows."
  }
]

Code changes:
${chunkContent}

Respond with ONLY a JSON array, no other text. Do not include explanations, thinking, or any text outside the JSON array. Start your response with [ and end with ].`;
};
exports.buildReviewPrompt = buildReviewPrompt;
// Helper function to validate comment structure
const isValidComment = (comment) => {
    if (typeof comment !== 'object' || comment === null) {
        return false;
    }
    const obj = comment;
    return typeof obj.file === 'string' &&
        (obj.line === undefined || typeof obj.line === 'number') &&
        typeof obj.comment === 'string';
};
// Pure function to parse AI response into ReviewComments
const parseAIResponse = (responseContent) => {
    let comments = [];
    try {
        // Try to parse the full response first
        const parsedResponse = JSON.parse(responseContent);
        comments = parsedResponse
            .filter((comment) => {
            if (!isValidComment(comment)) {
                core.warning(`Invalid comment structure found, skipping: ${JSON.stringify(comment)}`);
                return false;
            }
            return true;
        })
            .map((comment) => {
            const reviewComment = {
                path: comment.file,
                body: comment.comment,
                commentType: comment.line !== undefined ? 'diff' : 'file',
            };
            if (comment.line !== undefined) {
                reviewComment.line = comment.line;
            }
            if (comment.end_line !== undefined) {
                reviewComment.end_line = comment.end_line;
            }
            return reviewComment;
        });
    }
    catch (e) {
        // If that fails, try to extract JSON from the response
        try {
            const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsedResponse = JSON.parse(jsonMatch[0]);
                comments = parsedResponse
                    .filter((comment) => {
                    if (!isValidComment(comment)) {
                        core.warning(`Invalid comment structure found, skipping: ${JSON.stringify(comment)}`);
                        return false;
                    }
                    return true;
                })
                    .map((comment) => {
                    const reviewComment = {
                        path: comment.file,
                        body: comment.comment,
                        commentType: comment.line !== undefined ? 'diff' : 'file',
                    };
                    if (comment.line !== undefined) {
                        reviewComment.line = comment.line;
                    }
                    if (comment.end_line !== undefined) {
                        reviewComment.end_line = comment.end_line;
                    }
                    return reviewComment;
                });
            }
            else {
                core.warning("Failed to parse AI response as JSON - no JSON array found");
                core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
                comments = [];
            }
        }
        catch (e2) {
            core.warning("Failed to parse AI response as JSON");
            core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
            comments = [];
        }
    }
    return comments;
};
exports.parseAIResponse = parseAIResponse;
// Effect: Review a single chunk with repository context using secure credential management
const reviewChunk = async (chunk, config, provider, model) => {
    // Always use repository context if available (simplified approach)
    const prompt = (0, exports.buildReviewPrompt)(config, chunk.content, chunk.repositoryContext);
    core.info(`🔗 Calling AI provider: ${provider} with model: ${model}`);
    core.info(`📝 Prompt length: ${prompt.length} characters`);
    if (chunk.repositoryContext) {
        core.info(`🏗️ Using repository context with structure`);
    }
    if (chunk.contextualContent) {
        const fileCount = Object.keys(chunk.contextualContent).length;
        core.info(`📄 Including contextual content for ${fileCount} files`);
    }
    // Pre-request token estimation using provider-specific token counter with secure credentials
    let estimatedInputTokens = 0;
    try {
        const tokenCounter = token_counter_1.TokenCounterFactory.create(provider);
        const tokenResult = await tokenCounter.countTokens(prompt, model);
        estimatedInputTokens = tokenResult.tokens;
        core.info(`🔢 Estimated input tokens: ${estimatedInputTokens}`);
    }
    catch (error) {
        core.warning(`Failed to get accurate token count, using fallback: ${error}`);
        estimatedInputTokens = (0, review_1.countTokens)(prompt, model);
    }
    const response = await (0, ai_api_1.callAIProvider)(provider, prompt, model);
    core.info(`🤖 AI Response received: ${response.content.length} characters`);
    core.info(`📊 AI Response preview: "${response.content.substring(0, 200)}${response.content.length > 200 ? "..." : ""}"`);
    // Log enhanced usage information if available
    if (response.usage) {
        core.info(`📊 Token usage - Input: ${response.usage.input_tokens}, Output: ${response.usage.output_tokens}`);
        if (response.usage.cost) {
            core.info(`💰 Direct cost: $${response.usage.cost}`);
        }
        if (response.usage.cached_tokens) {
            core.info(`🗄️ Cached tokens: ${response.usage.cached_tokens}`);
        }
        if (response.usage.reasoning_tokens) {
            core.info(`🧠 Reasoning tokens: ${response.usage.reasoning_tokens}`);
        }
    }
    const comments = (0, exports.parseAIResponse)(response.content);
    core.info(`💬 Parsed ${comments.length} comments from AI response`);
    const tokens = response.usage
        ? {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens,
        }
        : {
            input: estimatedInputTokens || (0, review_1.countTokens)(prompt, model),
            output: (0, review_1.countTokens)(response.content, model),
        };
    return { comments, tokens };
};
exports.reviewChunk = reviewChunk;
//# sourceMappingURL=ai-review.js.map