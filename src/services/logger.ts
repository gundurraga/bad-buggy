import * as core from '@actions/core';
import { ReviewComment, TokenUsage } from '../types';
import { formatCost } from '../domains/cost';

/**
 * Centralized logging service for consistent and organized output
 */

export class Logger {
  static startup(): void {
    core.info('🚀 Starting Bad Buggy Action');
  }

  static inputs(provider: string, model: string, configFile: string): void {
    core.info('📋 Getting action inputs...');
    core.info(`✅ Inputs loaded: provider=${provider}, model=${model}, config=${configFile}`);
  }

  static inputValidation(): void {
    core.info('✅ Input validation passed');
  }

  static configLoading(configFile: string): void {
    core.info(`📄 Loading configuration from ${configFile}...`);
  }

  static configLoaded(maxComments: number): void {
    core.info(`✅ Configuration loaded: max_comments=${maxComments}`);
  }

  static configValidation(): void {
    core.info('✅ Configuration validation passed');
  }

  static githubInit(owner: string, repo: string, eventName: string): void {
    core.info('🔧 Initializing GitHub client...');
    core.info(`📊 GitHub context: repo=${owner}/${repo}, event=${eventName}`);
  }

  static prInfo(number: number, title: string, author: string, body: string | null, url: string, headRef: string, baseRef: string, additions: number, deletions: number, changedFiles: number): void {
    core.info(`📝 PR #${number}: "${title}" by ${author}`);
    core.info(`📄 PR Description: ${body ? body.substring(0, 200) + (body.length > 200 ? '...' : '') : 'No description provided'}`);
    core.info(`🔗 PR URL: ${url}`);
    core.info(`🌿 Branch: ${headRef} → ${baseRef}`);
    core.info(`📊 PR Stats: +${additions} -${deletions} changes in ${changedFiles} files`);
  }

  static securityCheck(): void {
    core.info('🔒 Performing security checks...');
  }

  static modifiedFiles(files: string[]): void {
    core.info(`📁 Modified files (${files.length}): ${files.join(', ')}`);
  }

  static securityPassed(): void {
    core.info('✅ Security checks passed');
  }

  static userPermissionCheck(username: string): void {
    core.info(`👤 Checking permissions for user: ${username}`);
  }

  static userPermissionLevel(level: string): void {
    core.info(`🔑 User permission level: ${level}`);
  }

  static userPermissionsPassed(): void {
    core.info('✅ User permissions verified');
  }

  static diffProcessing(): void {
    core.info('📊 Processing diff and creating chunks...');
  }

  static chunksCreated(count: number): void {
    core.info(`📦 Created ${count} chunks for review`);
  }

  static noFilesToReview(): void {
    core.info('⚠️ No files to review after applying ignore patterns');
  }

  static reviewStart(): void {
    core.info('🤖 Starting AI review process...');
  }

  static chunkReview(current: number, total: number, contentLength: number, files: string[] | undefined): void {
    core.info(`🔍 Reviewing chunk ${current}/${total} (${contentLength} chars)`);
    core.info(`📁 Chunk ${current} files: ${files ? files.join(', ') : 'N/A'}`);
  }

  static aiProviderCall(current: number, provider: string, model: string): void {
    core.info(`🤖 Sending chunk ${current} to AI provider: ${provider}`);
    core.info(`🎯 Using model: ${model}`);
  }

  static chunkResults(current: number, commentCount: number, inputTokens: number, outputTokens: number, duration: number): void {
    core.info(`📝 Chunk ${current} results: ${commentCount} comments, ${inputTokens} input tokens, ${outputTokens} output tokens (${duration}ms)`);
  }

  static chunkIssues(current: number, comments: ReviewComment[]): void {
    if (comments.length > 0) {
      core.info(`🔍 Chunk ${current} found issues:`);
      comments.forEach((comment, idx) => {
        core.info(`  ${idx + 1}. ${comment.path}:${comment.line} - ${comment.body.substring(0, 100)}${comment.body.length > 100 ? '...' : ''}`);
      });
    } else {
      core.info(`✅ Chunk ${current}: No issues found`);
    }
  }

  static totalResults(commentCount: number, inputTokens: number, outputTokens: number): void {
    core.info(`📊 Total review results: ${commentCount} raw comments, ${inputTokens} input tokens, ${outputTokens} output tokens`);
  }

  static commentProcessing(): void {
    core.info('🔄 Processing and filtering comments...');
  }



  static finalComments(finalCount: number, originalCount: number): void {
    core.info(`✨ Final comments after processing: ${finalCount} (filtered from ${originalCount})`);
  }

  static filteringReasons(maxComments: number): void {
    core.info('🔽 Comments filtered due to:');
    core.info(`  - Max comments limit: ${maxComments}`);

  }

  static postingReview(summaryLength: number, commentCount: number): void {
    core.info('📤 Posting review to GitHub...');
    core.info(`📝 Review summary length: ${summaryLength} characters`);
    core.info(`💬 Individual comments to post: ${commentCount}`);
  }

  static reviewPosted(commentCount: number, duration: number): void {
    core.info(`✅ Posted ${commentCount} review comments (${duration}ms)`);
  }

  static summaryOnly(summaryLength: number): void {
    core.info('ℹ️ No issues found in the code - posting summary comment');
    core.info(`📝 Summary-only review length: ${summaryLength} characters`);
  }

  static summaryPosted(duration: number): void {
    core.info(`✅ Posted summary review (${duration}ms)`);
  }

  static costCalculation(): void {
    core.info('💰 Calculating review costs...');
  }

  static costSummary(totalCost: number, inputCost: number, outputCost: number): void {
    const costMessage = `💰 AI Review Cost: ${formatCost(totalCost)} (${formatCost(inputCost)} input + ${formatCost(outputCost)} output)`;
    core.info(costMessage);
  }

  static costBreakdown(tokens: TokenUsage, inputCost: number, outputCost: number, totalCost: number): void {
    core.info('📊 Token breakdown:');
    core.info(`  Input tokens: ${tokens.input} (${formatCost(inputCost)})`);
    core.info(`  Output tokens: ${tokens.output} (${formatCost(outputCost)})`);
    core.info(`  Total tokens: ${tokens.input + tokens.output}`);
    core.info(`💵 Cost per review: ${formatCost(totalCost)}`);
    if (totalCost > 0) {
      const reviewsPerDollar = Math.floor(1 / totalCost);
      core.info(`📈 Reviews per dollar: ~${reviewsPerDollar}`);
    }
  }

  static completion(): void {
    core.info('🎉 Bad Buggy completed successfully!');
  }

  static commentFiltering(filteredCount: number, filteredComments: string[]): void {
    core.info(`🔍 Filtered out ${filteredCount} comments that referenced invalid diff lines`);
    if (filteredComments.length > 0) {
      core.info(`   Filtered comments: ${filteredComments.join(', ')}`);
    }
  }

  static error(message: string): void {
    core.setFailed(`Action failed: ${message}`);
  }
}