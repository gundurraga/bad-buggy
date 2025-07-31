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
exports.run = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const config_1 = require("./config");
const validation_1 = require("./validation");
const security_1 = require("./domains/security");
const review_1 = require("./domains/review");
const cost_1 = require("./domains/cost");
const github_1 = require("./domains/github");
const ai_api_1 = require("./effects/ai-api");
const github_api_1 = require("./effects/github-api");
// Pure function to get action inputs
const getActionInputs = () => {
    return {
        githubToken: core.getInput("github-token", { required: true }),
        aiProvider: core.getInput("ai-provider", { required: true }),
        apiKey: core.getInput("api-key", { required: true }),
        model: core.getInput("model", { required: true }),
        configFile: core.getInput("config-file") || ".github/ai-review-config.yml",
    };
};
// Effect: Review a single chunk
const reviewChunk = async (chunk, config, provider, apiKey, model) => {
    const prompt = `${config.review_prompt.replace("{{DATE}}", new Date().toISOString().split("T")[0])}

Please review the following code changes and provide feedback as a JSON array of comments.
Each comment should have:
- file: the filename
- line: the line number (from the diff)
- end_line: (optional) the end line for multi-line comments
- severity: "critical", "major", "minor", or "suggestion"
- category: one of ${config.review_aspects.join(", ")}
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
${chunk.content}

Respond with ONLY a JSON array, no other text. Do not include explanations, thinking, or any text outside the JSON array. Start your response with [ and end with ].`;
    core.info(`🔗 Calling AI provider: ${provider} with model: ${model}`);
    core.info(`📝 Prompt length: ${prompt.length} characters`);
    const response = await (0, ai_api_1.callAIProvider)(provider, prompt, apiKey, model);
    core.info(`🤖 AI Response received: ${response.content.length} characters`);
    core.info(`📊 AI Response preview: "${response.content.substring(0, 200)}${response.content.length > 200 ? "..." : ""}"`);
    // Parse JSON response (like the old index.js version)
    let comments = [];
    try {
        // Try to parse the full response first
        const parsedResponse = JSON.parse(response.content);
        comments = parsedResponse.map((comment) => ({
            path: comment.file,
            line: comment.line,
            end_line: comment.end_line,
            severity: comment.severity,
            body: comment.comment
        }));
    }
    catch (e) {
        // If that fails, try to extract JSON from the response
        try {
            const jsonMatch = response.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsedResponse = JSON.parse(jsonMatch[0]);
                comments = parsedResponse.map((comment) => ({
                    path: comment.file,
                    line: comment.line,
                    end_line: comment.end_line,
                    severity: comment.severity,
                    body: comment.comment
                }));
            }
            else {
                core.warning("Failed to parse AI response as JSON - no JSON array found");
                core.warning(`Response was: ${response.content.substring(0, 500)}...`);
                comments = [];
            }
        }
        catch (e2) {
            core.warning("Failed to parse AI response as JSON");
            core.warning(`Response was: ${response.content.substring(0, 500)}...`);
            comments = [];
        }
    }
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
// Main execution function
const run = async () => {
    try {
        core.info("🚀 Starting AI Code Review Action");
        // Get and validate inputs
        core.info("📋 Getting action inputs...");
        const inputs = getActionInputs();
        core.info(`✅ Inputs loaded: provider=${inputs.aiProvider}, model=${inputs.model}, config=${inputs.configFile}`);
        const inputValidation = (0, validation_1.validateInputs)(inputs);
        (0, validation_1.validateAndThrow)(inputValidation, "Input validation failed");
        core.info("✅ Input validation passed");
        // Load and validate configuration
        core.info(`📄 Loading configuration from ${inputs.configFile}...`);
        const config = await (0, config_1.loadConfig)(inputs.configFile);
        core.info(`✅ Configuration loaded: max_comments=${config.max_comments}, prioritize_by_severity=${config.prioritize_by_severity}`);
        const configValidation = (0, validation_1.validateConfig)(config);
        (0, validation_1.validateAndThrow)(configValidation, "Configuration validation failed");
        core.info("✅ Configuration validation passed");
        // Initialize GitHub client
        core.info("🔧 Initializing GitHub client...");
        const octokit = github.getOctokit(inputs.githubToken);
        const context = github.context;
        const pr = context.payload.pull_request;
        const triggeringUser = context.payload.sender;
        const repoOwner = context.repo.owner;
        core.info(`📊 GitHub context: repo=${context.repo.owner}/${context.repo.repo}, event=${context.eventName}`);
        if (!pr || !triggeringUser) {
            core.setFailed("This action can only be run on pull requests with a valid sender");
            return;
        }
        core.info(`📝 PR #${pr.number}: "${pr.title}" by ${triggeringUser.login}`);
        // Type assertion for GitHub context
        const typedPr = pr;
        const typedContext = context;
        // Security check
        core.info("🔒 Performing security checks...");
        const diff = await (0, github_api_1.getPRDiff)(octokit, typedContext, typedPr);
        const modifiedFiles = diff.map((file) => file.filename);
        core.info(`📁 Modified files (${modifiedFiles.length}): ${modifiedFiles.join(", ")}`);
        const securityCheck = (0, security_1.validateSecurity)(typedPr, triggeringUser, repoOwner, config, modifiedFiles);
        if (!securityCheck.allowed) {
            core.setFailed(securityCheck.message || "Security check failed");
            return;
        }
        core.info("✅ Security checks passed");
        // Check user permissions
        core.info(`👤 Checking permissions for user: ${triggeringUser.login}`);
        const userPermission = await (0, github_api_1.checkUserPermissions)(octokit, repoOwner, context.repo.repo, triggeringUser.login);
        core.info(`🔑 User permission level: ${userPermission}`);
        if (!["admin", "write"].includes(userPermission) &&
            triggeringUser.login !== repoOwner) {
            core.setFailed("User does not have sufficient permissions to trigger AI reviews");
            return;
        }
        core.info("✅ User permissions verified");
        // Process diff
        core.info("📊 Processing diff and creating chunks...");
        const chunks = (0, review_1.chunkDiff)(diff, config);
        core.info(`📦 Created ${chunks.length} chunks for review`);
        if (chunks.length === 0) {
            core.info("⚠️ No files to review after applying ignore patterns");
            return;
        }
        // Review chunks and accumulate results
        core.info("🤖 Starting AI review process...");
        let allComments = [];
        let totalTokens = { input: 0, output: 0 };
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            core.info(`🔍 Reviewing chunk ${i + 1}/${chunks.length} (${chunk.content.length} chars)`);
            const { comments, tokens } = await reviewChunk(chunk, config, inputs.aiProvider, inputs.apiKey, inputs.model);
            core.info(`📝 Chunk ${i + 1} results: ${comments.length} comments, ${tokens.input} input tokens, ${tokens.output} output tokens`);
            allComments = allComments.concat(comments);
            totalTokens = (0, cost_1.accumulateTokens)(totalTokens, tokens);
        }
        core.info(`📊 Total review results: ${allComments.length} raw comments, ${totalTokens.input} input tokens, ${totalTokens.output} output tokens`);
        // Process and post comments
        core.info("🔄 Processing and filtering comments...");
        const finalComments = (0, review_1.processComments)(allComments, config);
        core.info(`✨ Final comments after processing: ${finalComments.length} (filtered from ${allComments.length})`);
        const reviewBody = (0, github_1.formatReviewBody)(inputs.model, totalTokens, finalComments.length);
        if (finalComments.length > 0) {
            core.info("📤 Posting review to GitHub...");
            await (0, github_api_1.postReview)(octokit, typedContext, typedPr, finalComments, reviewBody);
            core.info(`✅ Posted ${finalComments.length} review comments`);
        }
        else {
            core.info("ℹ️ No issues found in the code - posting summary comment");
            // Post a summary even when no issues found
            await (0, github_api_1.postReview)(octokit, typedContext, typedPr, [], reviewBody);
        }
        // Report cost
        const cost = (0, cost_1.calculateCost)(inputs.model, totalTokens);
        const costMessage = `💰 AI Review Cost: ${(0, cost_1.formatCost)(cost.totalCost)} (${(0, cost_1.formatCost)(cost.inputCost)} input + ${(0, cost_1.formatCost)(cost.outputCost)} output)`;
        core.info(costMessage);
        core.info("🎉 AI Code Review completed successfully!");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.setFailed(`Action failed: ${errorMessage}`);
    }
};
exports.run = run;
// Execute if this is the main module
if (require.main === module) {
    (0, exports.run)();
}
//# sourceMappingURL=main.js.map