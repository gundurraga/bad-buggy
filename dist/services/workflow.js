"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewWorkflow = void 0;
const validation_1 = require("../validation");
const security_1 = require("../domains/security");
const review_1 = require("../domains/review");
const cost_1 = require("../domains/cost");
const github_1 = require("../domains/github");
const github_api_1 = require("../effects/github-api");
const ai_review_1 = require("./ai-review");
const logger_1 = require("./logger");
/**
 * Workflow orchestrator for the AI code review process
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
        const userPermission = await (0, github_api_1.checkUserPermissions)(this.octokit, repoOwner, this.context.repo.repo, triggeringUser.login);
        logger_1.Logger.userPermissionLevel(userPermission);
        if (!['admin', 'write'].includes(userPermission) &&
            triggeringUser.login !== repoOwner) {
            throw new Error('User does not have sufficient permissions to trigger AI reviews');
        }
        logger_1.Logger.userPermissionsPassed();
    }
    async processAndReviewDiff() {
        logger_1.Logger.diffProcessing();
        const pr = this.context.payload.pull_request;
        if (!pr) {
            throw new Error('Pull request not found in context');
        }
        const diff = await (0, github_api_1.getPRDiff)(this.octokit, this.context, pr);
        const chunks = (0, review_1.chunkDiff)(diff, this.config);
        logger_1.Logger.chunksCreated(chunks.length);
        if (chunks.length === 0) {
            logger_1.Logger.noFilesToReview();
            return { comments: [], tokens: { input: 0, output: 0 } };
        }
        logger_1.Logger.reviewStart();
        let allComments = [];
        let totalTokens = { input: 0, output: 0 };
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkNumber = i + 1;
            logger_1.Logger.chunkReview(chunkNumber, chunks.length, chunk.content.length, chunk.files);
            logger_1.Logger.aiProviderCall(chunkNumber, this.inputs.aiProvider, this.inputs.model);
            const startTime = Date.now();
            const { comments, tokens } = await (0, ai_review_1.reviewChunk)(chunk, this.config, this.inputs.aiProvider, this.inputs.apiKey, this.inputs.model);
            const duration = Date.now() - startTime;
            logger_1.Logger.chunkResults(chunkNumber, comments.length, tokens.input, tokens.output, duration);
            logger_1.Logger.chunkIssues(chunkNumber, comments);
            allComments = allComments.concat(comments);
            totalTokens = (0, cost_1.accumulateTokens)(totalTokens, tokens);
        }
        logger_1.Logger.totalResults(allComments.length, totalTokens.input, totalTokens.output);
        return { comments: allComments, tokens: totalTokens };
    }
    async processAndPostComments(allComments, totalTokens, modifiedFiles, pr, triggeringUser) {
        logger_1.Logger.commentProcessing();
        // Log severity breakdown
        const severityCounts = allComments.reduce((acc, comment) => {
            acc[comment.severity] = (acc[comment.severity] || 0) + 1;
            return acc;
        }, {});
        logger_1.Logger.severityBreakdown(severityCounts);
        const finalComments = (0, review_1.processComments)(allComments, this.config);
        logger_1.Logger.finalComments(finalComments.length, allComments.length);
        if (finalComments.length !== allComments.length) {
            logger_1.Logger.filteringReasons(this.config.max_comments, this.config.prioritize_by_severity);
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
        const reviewBody = (0, github_1.formatReviewBody)(this.inputs.model, totalTokens, finalComments.length, prInfo);
        if (finalComments.length > 0) {
            logger_1.Logger.postingReview(reviewBody.length, finalComments.length);
            const postStartTime = Date.now();
            await (0, github_api_1.postReview)(this.octokit, this.context, pr, finalComments, reviewBody);
            const postDuration = Date.now() - postStartTime;
            logger_1.Logger.reviewPosted(finalComments.length, postDuration);
        }
        else {
            logger_1.Logger.summaryOnly(reviewBody.length);
            const postStartTime = Date.now();
            await (0, github_api_1.postReview)(this.octokit, this.context, pr, [], reviewBody);
            const postDuration = Date.now() - postStartTime;
            logger_1.Logger.summaryPosted(postDuration);
        }
    }
    async reportCosts(totalTokens) {
        logger_1.Logger.costCalculation();
        const cost = (0, cost_1.calculateCost)(this.inputs.model, totalTokens);
        logger_1.Logger.costSummary(cost.totalCost, cost.inputCost, cost.outputCost);
        logger_1.Logger.costBreakdown(totalTokens, cost.inputCost, cost.outputCost, cost.totalCost);
    }
}
exports.ReviewWorkflow = ReviewWorkflow;
//# sourceMappingURL=workflow.js.map