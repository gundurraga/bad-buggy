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
        githubToken: core.getInput('github-token', { required: true }),
        aiProvider: core.getInput('ai-provider', { required: true }),
        apiKey: core.getInput('api-key', { required: true }),
        model: core.getInput('model', { required: true }),
        configFile: core.getInput('config-file') || '.github/ai-review-config.yml'
    };
};
// Effect: Review a single chunk
const reviewChunk = async (chunk, config, provider, apiKey, model) => {
    const prompt = `${config.review_prompt}\n\nCode to review:\n${chunk.content}`;
    const response = await (0, ai_api_1.callAIProvider)(provider, prompt, apiKey, model);
    const comments = (0, review_1.parseAIResponse)(response.content);
    const tokens = response.usage ? {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens
    } : {
        input: (0, review_1.countTokens)(prompt, model),
        output: (0, review_1.countTokens)(response.content, model)
    };
    return { comments, tokens };
};
// Main execution function
const run = async () => {
    try {
        // Get and validate inputs
        const inputs = getActionInputs();
        const inputValidation = (0, validation_1.validateInputs)(inputs);
        (0, validation_1.validateAndThrow)(inputValidation, 'Input validation failed');
        // Load and validate configuration
        const config = await (0, config_1.loadConfig)(inputs.configFile);
        const configValidation = (0, validation_1.validateConfig)(config);
        (0, validation_1.validateAndThrow)(configValidation, 'Configuration validation failed');
        // Initialize GitHub client
        const octokit = github.getOctokit(inputs.githubToken);
        const context = github.context;
        const pr = context.payload.pull_request;
        const triggeringUser = context.payload.sender;
        const repoOwner = context.repo.owner;
        if (!pr || !triggeringUser) {
            core.setFailed('This action can only be run on pull requests with a valid sender');
            return;
        }
        // Type assertion for GitHub context
        const typedPr = pr;
        const typedContext = context;
        // Security check
        const diff = await (0, github_api_1.getPRDiff)(octokit, typedContext, typedPr);
        const modifiedFiles = diff.map(file => file.filename);
        const securityCheck = (0, security_1.validateSecurity)(typedPr, triggeringUser, repoOwner, config, modifiedFiles);
        if (!securityCheck.allowed) {
            core.setFailed(securityCheck.message || 'Security check failed');
            return;
        }
        // Check user permissions
        const userPermission = await (0, github_api_1.checkUserPermissions)(octokit, repoOwner, context.repo.repo, triggeringUser.login);
        if (!['admin', 'write'].includes(userPermission) && triggeringUser.login !== repoOwner) {
            core.setFailed('User does not have sufficient permissions to trigger AI reviews');
            return;
        }
        // Process diff
        const chunks = (0, review_1.chunkDiff)(diff, config);
        if (chunks.length === 0) {
            core.info('No files to review after applying ignore patterns');
            return;
        }
        // Review chunks and accumulate results
        let allComments = [];
        let totalTokens = { input: 0, output: 0 };
        for (const chunk of chunks) {
            const { comments, tokens } = await reviewChunk(chunk, config, inputs.aiProvider, inputs.apiKey, inputs.model);
            allComments = allComments.concat(comments);
            totalTokens = (0, cost_1.accumulateTokens)(totalTokens, tokens);
        }
        // Process and post comments
        const finalComments = (0, review_1.processComments)(allComments, config);
        const reviewBody = (0, github_1.formatReviewBody)(inputs.model, totalTokens, finalComments.length);
        if (finalComments.length > 0) {
            await (0, github_api_1.postReview)(octokit, typedContext, typedPr, finalComments, reviewBody);
            core.info(`Posted ${finalComments.length} review comments`);
        }
        else {
            core.info('No issues found in the code');
        }
        // Report cost
        const cost = (0, cost_1.calculateCost)(inputs.model, totalTokens);
        const costMessage = `AI Review Cost: ${(0, cost_1.formatCost)(cost.totalCost)} (${(0, cost_1.formatCost)(cost.inputCost)} input + ${(0, cost_1.formatCost)(cost.outputCost)} output)`;
        core.info(costMessage);
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