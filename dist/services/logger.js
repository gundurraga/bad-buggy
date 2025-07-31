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
exports.Logger = void 0;
const core = __importStar(require("@actions/core"));
const cost_1 = require("../domains/cost");
/**
 * Centralized logging service for consistent and organized output
 */
class Logger {
    static startup() {
        core.info('🚀 Starting AI Code Review Action');
    }
    static inputs(provider, model, configFile) {
        core.info('📋 Getting action inputs...');
        core.info(`✅ Inputs loaded: provider=${provider}, model=${model}, config=${configFile}`);
    }
    static inputValidation() {
        core.info('✅ Input validation passed');
    }
    static configLoading(configFile) {
        core.info(`📄 Loading configuration from ${configFile}...`);
    }
    static configLoaded(maxComments, prioritizeBySeverity) {
        core.info(`✅ Configuration loaded: max_comments=${maxComments}, prioritize_by_severity=${prioritizeBySeverity}`);
    }
    static configValidation() {
        core.info('✅ Configuration validation passed');
    }
    static githubInit(owner, repo, eventName) {
        core.info('🔧 Initializing GitHub client...');
        core.info(`📊 GitHub context: repo=${owner}/${repo}, event=${eventName}`);
    }
    static prInfo(number, title, author, body, url, headRef, baseRef, additions, deletions, changedFiles) {
        core.info(`📝 PR #${number}: "${title}" by ${author}`);
        core.info(`📄 PR Description: ${body ? body.substring(0, 200) + (body.length > 200 ? '...' : '') : 'No description provided'}`);
        core.info(`🔗 PR URL: ${url}`);
        core.info(`🌿 Branch: ${headRef} → ${baseRef}`);
        core.info(`📊 PR Stats: +${additions} -${deletions} changes in ${changedFiles} files`);
    }
    static securityCheck() {
        core.info('🔒 Performing security checks...');
    }
    static modifiedFiles(files) {
        core.info(`📁 Modified files (${files.length}): ${files.join(', ')}`);
    }
    static securityPassed() {
        core.info('✅ Security checks passed');
    }
    static userPermissionCheck(username) {
        core.info(`👤 Checking permissions for user: ${username}`);
    }
    static userPermissionLevel(level) {
        core.info(`🔑 User permission level: ${level}`);
    }
    static userPermissionsPassed() {
        core.info('✅ User permissions verified');
    }
    static diffProcessing() {
        core.info('📊 Processing diff and creating chunks...');
    }
    static chunksCreated(count) {
        core.info(`📦 Created ${count} chunks for review`);
    }
    static noFilesToReview() {
        core.info('⚠️ No files to review after applying ignore patterns');
    }
    static reviewStart() {
        core.info('🤖 Starting AI review process...');
    }
    static chunkReview(current, total, contentLength, files) {
        core.info(`🔍 Reviewing chunk ${current}/${total} (${contentLength} chars)`);
        core.info(`📁 Chunk ${current} files: ${files ? files.join(', ') : 'N/A'}`);
    }
    static aiProviderCall(current, provider, model) {
        core.info(`🤖 Sending chunk ${current} to AI provider: ${provider}`);
        core.info(`🎯 Using model: ${model}`);
    }
    static chunkResults(current, commentCount, inputTokens, outputTokens, duration) {
        core.info(`📝 Chunk ${current} results: ${commentCount} comments, ${inputTokens} input tokens, ${outputTokens} output tokens (${duration}ms)`);
    }
    static chunkIssues(current, comments) {
        if (comments.length > 0) {
            core.info(`🔍 Chunk ${current} found issues:`);
            comments.forEach((comment, idx) => {
                core.info(`  ${idx + 1}. [${comment.severity}] ${comment.path}:${comment.line} - ${comment.body.substring(0, 100)}${comment.body.length > 100 ? '...' : ''}`);
            });
        }
        else {
            core.info(`✅ Chunk ${current}: No issues found`);
        }
    }
    static totalResults(commentCount, inputTokens, outputTokens) {
        core.info(`📊 Total review results: ${commentCount} raw comments, ${inputTokens} input tokens, ${outputTokens} output tokens`);
    }
    static commentProcessing() {
        core.info('🔄 Processing and filtering comments...');
    }
    static severityBreakdown(severityCounts) {
        core.info('📊 Raw comments by severity:');
        Object.entries(severityCounts).forEach(([severity, count]) => {
            core.info(`  ${severity}: ${count} comments`);
        });
    }
    static finalComments(finalCount, originalCount) {
        core.info(`✨ Final comments after processing: ${finalCount} (filtered from ${originalCount})`);
    }
    static filteringReasons(maxComments, prioritizeBySeverity) {
        core.info('🔽 Comments filtered due to:');
        core.info(`  - Max comments limit: ${maxComments}`);
        core.info(`  - Severity prioritization: ${prioritizeBySeverity}`);
    }
    static postingReview(summaryLength, commentCount) {
        core.info('📤 Posting review to GitHub...');
        core.info(`📝 Review summary length: ${summaryLength} characters`);
        core.info(`💬 Individual comments to post: ${commentCount}`);
    }
    static reviewPosted(commentCount, duration) {
        core.info(`✅ Posted ${commentCount} review comments (${duration}ms)`);
    }
    static summaryOnly(summaryLength) {
        core.info('ℹ️ No issues found in the code - posting summary comment');
        core.info(`📝 Summary-only review length: ${summaryLength} characters`);
    }
    static summaryPosted(duration) {
        core.info(`✅ Posted summary review (${duration}ms)`);
    }
    static costCalculation() {
        core.info('💰 Calculating review costs...');
    }
    static costSummary(totalCost, inputCost, outputCost) {
        const costMessage = `💰 AI Review Cost: ${(0, cost_1.formatCost)(totalCost)} (${(0, cost_1.formatCost)(inputCost)} input + ${(0, cost_1.formatCost)(outputCost)} output)`;
        core.info(costMessage);
    }
    static costBreakdown(tokens, inputCost, outputCost, totalCost) {
        core.info('📊 Token breakdown:');
        core.info(`  Input tokens: ${tokens.input} (${(0, cost_1.formatCost)(inputCost)})`);
        core.info(`  Output tokens: ${tokens.output} (${(0, cost_1.formatCost)(outputCost)})`);
        core.info(`  Total tokens: ${tokens.input + tokens.output}`);
        core.info(`💵 Cost per review: ${(0, cost_1.formatCost)(totalCost)}`);
        if (totalCost > 0) {
            const reviewsPerDollar = Math.floor(1 / totalCost);
            core.info(`📈 Reviews per dollar: ~${reviewsPerDollar}`);
        }
    }
    static completion() {
        core.info('🎉 AI Code Review completed successfully!');
    }
    static error(message) {
        core.setFailed(`Action failed: ${message}`);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map