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

Please review the following code changes and provide feedback as a JSON array of comments.
Each comment should have:
- file: the filename
- line: the line number (from the diff)
- end_line: (optional) the end line for multi-line comments
- severity: "critical", "major", or "suggestion"
- comment: your feedback

Examples of correct JSON responses:

[
  {
    "file": "src/auth.js",
    "line": 45,
    "end_line": 65,
    "severity": "critical",
    "comment": "CRITICAL: SQL injection vulnerability. User input 'userInput' is directly concatenated into query without sanitization. IMPACT: Database compromise, data theft. IMMEDIATE ACTION: Use parameterized queries or ORM methods."
  },
  {
    "file": "src/payment.js", 
    "line": 78,
    "end_line": 85,
    "severity": "major", 
    "comment": "Race condition in payment processing. Multiple concurrent transactions can cause double-charging. IMPACT: Financial loss, customer complaints. IMMEDIATE ACTION: Add transaction locking or atomic operations."
  }
]

Code changes:
${chunkContent}

Respond with ONLY a JSON array, no other text. Do not include explanations, thinking, or any text outside the JSON array. Start your response with [ and end with ].`;
};
exports.buildReviewPrompt = buildReviewPrompt;
// Helper function to validate severity
const isValidSeverity = (severity) => {
    return ["critical", "major", "suggestion"].includes(severity);
};
// Pure function to parse AI response into ReviewComments
const parseAIResponse = (responseContent) => {
    let comments = [];
    try {
        // Try to parse the full response first
        const parsedResponse = JSON.parse(responseContent);
        comments = parsedResponse.map((comment) => {
            if (!isValidSeverity(comment.severity)) {
                core.warning(`Invalid severity '${comment.severity}' found, defaulting to 'suggestion'`);
                comment.severity = "suggestion";
            }
            return {
                path: comment.file,
                line: comment.line,
                end_line: comment.end_line,
                severity: comment.severity,
                body: comment.comment,
            };
        });
    }
    catch (e) {
        // If that fails, try to extract JSON from the response
        try {
            const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsedResponse = JSON.parse(jsonMatch[0]);
                comments = parsedResponse.map((comment) => {
                    if (!isValidSeverity(comment.severity)) {
                        core.warning(`Invalid severity '${comment.severity}' found, defaulting to 'suggestion'`);
                        comment.severity = "suggestion";
                    }
                    return {
                        path: comment.file,
                        line: comment.line,
                        end_line: comment.end_line,
                        severity: comment.severity,
                        body: comment.comment,
                    };
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