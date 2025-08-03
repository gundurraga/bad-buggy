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
exports.ReviewWorkflow = void 0;
const core = __importStar(require("@actions/core"));
const validation_1 = require("../validation");
const security_1 = require("../domains/security");
const review_1 = require("../domains/review");
const cost_1 = require("../domains/cost");
const github_1 = require("../domains/github");
const github_api_1 = require("../effects/github-api");
const ai_review_1 = require("./ai-review");
const logger_1 = require("./logger");
// Permission level constants
const PERMISSION_LEVELS = {
    ADMIN: 'admin',
    WRITE: 'write',
    READ: 'read',
    NONE: 'none'
};
const REQUIRED_PERMISSIONS = [PERMISSION_LEVELS.ADMIN, PERMISSION_LEVELS.WRITE];
/**
 * Workflow orchestrator for the Bad Buggy code review process
 */
class ReviewWorkflow {
    constructor(octokit, context, inputs, config) {
        this.octokit = octokit;
        this.context = context;
        this.inputs = inputs;
        this.config = config;
    }
    async validateInputs() {
        const inputValidation = (0, validation_1.validateInputs)(this.inputs);
        (0, validation_1.validateAndThrow)(inputValidation, 'Input validation failed');
        logger_1.Logger.inputValidation();
    }
    async validateConfig() {
        const configValidation = (0, validation_1.validateConfig)(this.config);
        (0, validation_1.validateAndThrow)(configValidation, 'Configuration validation failed');
        logger_1.Logger.configValidation();
    }
    async validatePullRequest() {
        const pr = this.context.payload.pull_request;
        const triggeringUser = this.context.payload.sender;
        const repoOwner = this.context.repo.owner;
        if (!pr || !triggeringUser) {
            throw new Error('This action can only be run on pull requests with a valid sender');
        }
        logger_1.Logger.prInfo(pr.number, pr.title || 'No title', triggeringUser.login, pr.body || null, pr.html_url || '', pr.head?.ref || 'unknown', pr.base?.ref || 'unknown', pr.additions || 0, pr.deletions || 0, pr.changed_files || 0);
        return { pr, triggeringUser, repoOwner };
    }
    async performSecurityChecks(pr, triggeringUser, repoOwner) {
        logger_1.Logger.securityCheck();
        const diff = await (0, github_api_1.getPRDiff)(this.octokit, this.context, pr);
        const modifiedFiles = diff.map((file) => file.filename);
        logger_1.Logger.modifiedFiles(modifiedFiles);
        const securityCheck = (0, security_1.validateSecurity)(pr, triggeringUser, repoOwner, this.config, modifiedFiles);
        if (!securityCheck.allowed) {
            throw new Error(securityCheck.message || 'Security check failed');
        }
        logger_1.Logger.securityPassed();
        return modifiedFiles;
    }
    async checkUserPermissions(triggeringUser, repoOwner) {
        logger_1.Logger.userPermissionCheck(triggeringUser.login);
        // Real-time permission validation
        const userPermission = await (0, github_api_1.checkUserPermissions)(this.octokit, repoOwner, this.context.repo.repo, triggeringUser.login);
        logger_1.Logger.userPermissionLevel(userPermission);
        // Validate against required permission levels using constants
        const hasRequiredPermission = REQUIRED_PERMISSIONS.includes(userPermission);
        const isRepoOwner = triggeringUser.login === repoOwner;
        if (!hasRequiredPermission && !isRepoOwner) {
            throw new Error(`User does not have sufficient permissions to trigger AI reviews. Required: ${REQUIRED_PERMISSIONS.join(' or ')}, Current: ${userPermission}`);
        }
        // Double-check permissions haven't changed during execution
        const revalidatedPermission = await (0, github_api_1.checkUserPermissions)(this.octokit, repoOwner, this.context.repo.repo, triggeringUser.login);
        if (revalidatedPermission !== userPermission) {
            throw new Error(`Permission level changed during execution. Original: ${userPermission}, Current: ${revalidatedPermission}`);
        }
        logger_1.Logger.userPermissionsPassed();
    }
    async processAndReviewDiff() {
        logger_1.Logger.diffProcessing();
        const pr = this.context.payload.pull_request;
        if (!pr) {
            throw new Error('Pull request not found in context');
        }
        // Always handle incremental reviews (simplified approach)
        const reviewState = await (0, github_api_1.getReviewState)(this.octokit, this.context, pr);
        const incrementalDiff = await (0, github_api_1.getIncrementalDiff)(this.octokit, this.context, pr, reviewState?.lastReviewedSha);
        const incrementalResult = (0, review_1.processIncrementalDiff)(incrementalDiff, this.config);
        if (!incrementalResult.shouldReview) {
            core.info(incrementalResult.message || 'No new changes to review');
            return {
                comments: [],
                tokens: { input: 0, output: 0 },
                fileChanges: incrementalDiff.changedFiles,
                incrementalMessage: incrementalResult.message
            };
        }
        const incrementalMessage = incrementalResult.message;
        core.info(incrementalMessage || 'Processing incremental review');
        // Always get repository context (simplified approach)
        let repositoryContext;
        try {
            repositoryContext = await (0, github_api_1.getRepositoryContext)(this.octokit, this.context, pr);
            core.info(`📁 Repository context gathered: ${repositoryContext.structure.totalFiles} files`);
        }
        catch (error) {
            core.warning(`Failed to get repository context: ${error}`);
            // Continue with basic diff review if context fails
        }
        // Always create chunks with contextual content (±100 lines strategy)
        const chunks = await (0, review_1.chunkDiff)(incrementalDiff.changedFiles, this.config, repositoryContext, this.octokit, this.context, pr.head.sha);
        logger_1.Logger.chunksCreated(chunks.length);
        if (chunks.length === 0) {
            logger_1.Logger.noFilesToReview();
            return {
                comments: [],
                tokens: { input: 0, output: 0 },
                fileChanges: incrementalDiff.changedFiles,
                incrementalMessage
            };
        }
        logger_1.Logger.reviewStart();
        let allComments = [];
        let totalTokens = { input: 0, output: 0 };
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkNumber = i + 1;
            logger_1.Logger.chunkReview(chunkNumber, chunks.length, chunk.content.length, chunk.fileChanges.map(f => f.filename));
            logger_1.Logger.aiProviderCall(chunkNumber, this.inputs.aiProvider, this.inputs.model);
            const startTime = Date.now();
            const { comments, tokens } = await (0, ai_review_1.reviewChunk)(chunk, this.config, this.inputs.aiProvider, this.inputs.model);
            const duration = Date.now() - startTime;
            logger_1.Logger.chunkResults(chunkNumber, comments.length, tokens.input, tokens.output, duration);
            logger_1.Logger.chunkIssues(chunkNumber, comments);
            allComments = allComments.concat(comments);
            totalTokens = (0, cost_1.accumulateTokens)(totalTokens, tokens);
        }
        // Always save review state for incremental reviews
        if (incrementalDiff.newCommits.length > 0) {
            const newReviewState = {
                prNumber: this.context.payload.pull_request?.number || 0,
                lastReviewedSha: pr.head.sha,
                reviewedCommits: incrementalDiff.newCommits,
                timestamp: new Date().toISOString()
            };
            await (0, github_api_1.saveReviewState)(this.octokit, this.context, pr, newReviewState);
            core.info(`💾 Review state saved for commit: ${pr.head.sha.substring(0, 7)}`);
        }
        logger_1.Logger.totalResults(allComments.length, totalTokens.input, totalTokens.output);
        return {
            comments: allComments,
            tokens: totalTokens,
            fileChanges: incrementalDiff.changedFiles,
            incrementalMessage
        };
    }
    async processAndPostComments(allComments, totalTokens, modifiedFiles, pr, triggeringUser, fileChanges, incrementalMessage) {
        logger_1.Logger.commentProcessing();
        // Log comment count
        core.info(`Total comments generated: ${allComments.length}`);
        const finalComments = (0, review_1.processComments)(allComments, this.config);
        logger_1.Logger.finalComments(finalComments.length, allComments.length);
        if (finalComments.length !== allComments.length) {
            logger_1.Logger.filteringReasons(this.config.max_comments);
        }
        // Prepare PR information for summary
        const prInfo = {
            title: pr.title || 'No title',
            description: pr.body || '',
            author: triggeringUser.login,
            filesChanged: modifiedFiles,
            additions: pr.additions || 0,
            deletions: pr.deletions || 0
        };
        let reviewBody = (0, github_1.formatReviewBody)(this.inputs.model, totalTokens, finalComments.length, prInfo);
        // Prepend incremental message if available
        if (incrementalMessage) {
            reviewBody = `${incrementalMessage}\n\n${reviewBody}`;
        }
        if (finalComments.length > 0) {
            logger_1.Logger.postingReview(reviewBody.length, finalComments.length);
            const postStartTime = Date.now();
            await (0, github_api_1.postReview)(this.octokit, this.context, pr, finalComments, reviewBody, fileChanges);
            const postDuration = Date.now() - postStartTime;
            logger_1.Logger.reviewPosted(finalComments.length, postDuration);
        }
        else {
            logger_1.Logger.summaryOnly(reviewBody.length);
            const postStartTime = Date.now();
            await (0, github_api_1.postReview)(this.octokit, this.context, pr, [], reviewBody, fileChanges);
            const postDuration = Date.now() - postStartTime;
            logger_1.Logger.summaryPosted(postDuration);
        }
    }
    async reportCosts(totalTokens) {
        logger_1.Logger.costCalculation();
        try {
            // Use dynamic cost calculation with real-time pricing and secure credential management
            const cost = await (0, cost_1.calculateCost)(totalTokens, this.inputs.model, this.inputs.aiProvider);
            logger_1.Logger.costSummary(cost.totalCost, cost.inputCost, cost.outputCost);
            logger_1.Logger.costBreakdown(totalTokens, cost.inputCost, cost.outputCost, cost.totalCost);
        }
        catch (error) {
            console.error(`Cost calculation failed: ${error}`);
            console.log(`Token usage - Input: ${totalTokens.input}, Output: ${totalTokens.output}`);
            console.log('Ensure API keys are valid and models are supported by the provider.');
        }
    }
}
exports.ReviewWorkflow = ReviewWorkflow;
//# sourceMappingURL=workflow.js.map