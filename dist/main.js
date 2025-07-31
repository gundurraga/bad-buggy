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
const workflow_1 = require("./services/workflow");
const logger_1 = require("./services/logger");
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
// Main execution function
const run = async () => {
    try {
        logger_1.Logger.startup();
        // Get and validate inputs
        const inputs = getActionInputs();
        logger_1.Logger.inputs(inputs.aiProvider, inputs.model, inputs.configFile);
        // Load and validate configuration
        logger_1.Logger.configLoading(inputs.configFile);
        const config = await (0, config_1.loadConfig)(inputs.configFile);
        logger_1.Logger.configLoaded(config.max_comments, config.prioritize_by_severity);
        // Initialize GitHub client and context
        const octokit = github.getOctokit(inputs.githubToken);
        const context = github.context;
        logger_1.Logger.githubInit(context.repo.owner, context.repo.repo, context.eventName);
        // Create workflow orchestrator
        const workflow = new workflow_1.ReviewWorkflow(octokit, context, inputs, config);
        // Execute workflow steps
        await workflow.validateInputs();
        await workflow.validateConfig();
        const { pr, triggeringUser, repoOwner } = await workflow.validatePullRequest();
        const modifiedFiles = await workflow.performSecurityChecks(pr, triggeringUser, repoOwner);
        await workflow.checkUserPermissions(triggeringUser, repoOwner);
        const { comments, tokens, fileChanges } = await workflow.processAndReviewDiff();
        if (comments.length === 0 && tokens.input === 0) {
            return; // No files to review
        }
        await workflow.processAndPostComments(comments, tokens, modifiedFiles, pr, triggeringUser, fileChanges);
        await workflow.reportCosts(tokens);
        logger_1.Logger.completion();
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Classify error types for better debugging
        if (error instanceof Error) {
            if (error.message.includes('validation')) {
                core.setFailed(`Configuration Error: ${errorMessage}`);
                process.exit(1);
            }
            else if (error.message.includes('permission')) {
                core.setFailed(`Permission Error: ${errorMessage}`);
                process.exit(2);
            }
            else if (error.message.includes('API')) {
                core.setFailed(`API Error: ${errorMessage}`);
                process.exit(3);
            }
            else {
                core.setFailed(`Unexpected Error: ${errorMessage}`);
                process.exit(4);
            }
        }
        else {
            core.setFailed(`Unknown Error: ${errorMessage}`);
            process.exit(5);
        }
        logger_1.Logger.error(errorMessage);
    }
};
exports.run = run;
// Execute if this is the main module
if (require.main === module) {
    (0, exports.run)().catch((error) => {
        console.error('Fatal error during execution:', error);
        process.exit(6);
    });
}
//# sourceMappingURL=main.js.map