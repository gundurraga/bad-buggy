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
/**
 * Service for handling Bad Buggy-powered code review operations
 */
// Pure function to build review prompt
const buildReviewPrompt = (config, chunkContent) => {
    const basePrompt = config.review_prompt.replace('{{DATE}}', new Date().toISOString().split('T')[0]);
    return `${basePrompt}

Please review the following code changes and provide feedback as a JSON array of comments.
Each comment should have:
- file: the filename
- line: the line number (from the diff)
- end_line: (optional) the end line for multi-line comments
- severity: "critical", "major", or "suggestion"
- category: one of ${config.review_aspects.join(', ')}
- comment: your feedback

Examples of correct JSON responses:

[
  {
    "file": "src/auth.js",
    "line": 45,
    "severity": "critical",
    "category": "security_vulnerabilities",
    "comment": "CRITICAL: SQL injection vulnerability. User input 'userInput' is directly concatenated into query without sanitization. IMPACT: Database compromise, data theft. IMMEDIATE ACTION: Use parameterized queries or ORM methods."
  },
  {
    "file": "src/payment.js", 
    "line": 78,
    "end_line": 85,
    "severity": "major", 
    "category": "bugs",
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
    return ['critical', 'major', 'suggestion'].includes(severity);
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
                comment.severity = 'suggestion';
            }
            return {
                path: comment.file,
                line: comment.line,
                end_line: comment.end_line,
                severity: comment.severity,
                body: comment.comment
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
                        comment.severity = 'suggestion';
                    }
                    return {
                        path: comment.file,
                        line: comment.line,
                        end_line: comment.end_line,
                        severity: comment.severity,
                        body: comment.comment
                    };
                });
            }
            else {
                core.warning('Failed to parse AI response as JSON - no JSON array found');
                core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
                comments = [];
            }
        }
        catch (e2) {
            core.warning('Failed to parse AI response as JSON');
            core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
            comments = [];
        }
    }
    return comments;
};
exports.parseAIResponse = parseAIResponse;
// Effect: Review a single chunk
const reviewChunk = async (chunk, config, provider, apiKey, model) => {
    const prompt = (0, exports.buildReviewPrompt)(config, chunk.content);
    core.info(`🔗 Calling AI provider: ${provider} with model: ${model}`);
    core.info(`📝 Prompt length: ${prompt.length} characters`);
    const response = await (0, ai_api_1.callAIProvider)(provider, prompt, apiKey, model);
    core.info(`🤖 AI Response received: ${response.content.length} characters`);
    core.info(`📊 AI Response preview: "${response.content.substring(0, 200)}${response.content.length > 200 ? '...' : ''}"`);
    const comments = (0, exports.parseAIResponse)(response.content);
    core.info(`💬 Parsed ${comments.length} comments from AI response`);
    const tokens = response.usage
        ? {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens,
        }
        : {
            input: (0, review_1.countTokens)(prompt, model),
            output: (0, review_1.countTokens)(response.content, model),
        };
    return { comments, tokens };
};
exports.reviewChunk = reviewChunk;
//# sourceMappingURL=ai-review.js.map