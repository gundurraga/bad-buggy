import * as core from '@actions/core';
import * as github from '@actions/github';
import { ActionInputs, ReviewConfig, TokenUsage, ReviewComment, PullRequest, User, FileChange, ReviewState, RepositoryContext } from '../types';
import { validateInputs, validateConfig, validateAndThrow } from '../validation';
import { validateSecurity } from '../domains/security';
import { chunkDiff, processComments, processIncrementalDiff } from '../domains/review';
import { calculateCost, accumulateTokens } from '../domains/cost';
import { formatReviewBody } from '../domains/github';
import { getPRDiff, postReview, checkUserPermissions, getReviewState, saveReviewState, getIncrementalDiff, getRepositoryContext } from '../effects/github-api';
import { reviewChunk } from './ai-review';
import { Logger } from './logger';

// Permission level constants
const PERMISSION_LEVELS = {
  ADMIN: 'admin',
  WRITE: 'write',
  READ: 'read',
  NONE: 'none'
} as const;

const REQUIRED_PERMISSIONS = [PERMISSION_LEVELS.ADMIN, PERMISSION_LEVELS.WRITE] as const;

/**
 * Workflow orchestrator for the Bad Buggy code review process
 */

export class ReviewWorkflow {
  private octokit: ReturnType<typeof github.getOctokit>;
  private context: typeof github.context;
  private inputs: ActionInputs;
  private config: ReviewConfig;

  constructor(
    octokit: ReturnType<typeof github.getOctokit>,
    context: typeof github.context,
    inputs: ActionInputs,
    config: ReviewConfig
  ) {
    this.octokit = octokit;
    this.context = context;
    this.inputs = inputs;
    this.config = config;
  }

  async validateInputs(): Promise<void> {
    const inputValidation = validateInputs(this.inputs);
    validateAndThrow(inputValidation, 'Input validation failed');
    Logger.inputValidation();
  }

  async validateConfig(): Promise<void> {
    const configValidation = validateConfig(this.config);
    validateAndThrow(configValidation, 'Configuration validation failed');
    Logger.configValidation();
  }

  async validatePullRequest(): Promise<{ pr: PullRequest; triggeringUser: User; repoOwner: string }> {
    const pr = this.context.payload.pull_request as PullRequest;
    const triggeringUser = this.context.payload.sender as User;
    const repoOwner = this.context.repo.owner;

    if (!pr || !triggeringUser) {
      throw new Error('This action can only be run on pull requests with a valid sender');
    }

    Logger.prInfo(
      pr.number,
      pr.title || 'No title',
      triggeringUser.login,
      pr.body || null,
      pr.html_url || '',
      pr.head?.ref || 'unknown',
      pr.base?.ref || 'unknown',
      pr.additions || 0,
      pr.deletions || 0,
      (pr as PullRequest & { changed_files?: number }).changed_files || 0
    );

    return { pr, triggeringUser, repoOwner };
  }

  async performSecurityChecks(pr: PullRequest, triggeringUser: User, repoOwner: string): Promise<string[]> {
    Logger.securityCheck();
    
    const diff = await getPRDiff(this.octokit, this.context, pr);
    const modifiedFiles = diff.map((file) => file.filename);
    Logger.modifiedFiles(modifiedFiles);

    const securityCheck = validateSecurity(
      pr,
      triggeringUser,
      repoOwner,
      this.config,
      modifiedFiles
    );

    if (!securityCheck.allowed) {
      throw new Error(securityCheck.message || 'Security check failed');
    }
    
    Logger.securityPassed();
    return modifiedFiles;
  }

  async checkUserPermissions(triggeringUser: User, repoOwner: string): Promise<void> {
    Logger.userPermissionCheck(triggeringUser.login);
    
    // Real-time permission validation
    const userPermission = await checkUserPermissions(
      this.octokit,
      repoOwner,
      this.context.repo.repo,
      triggeringUser.login
    );
    
    Logger.userPermissionLevel(userPermission);

    // Validate against required permission levels using constants
    const hasRequiredPermission = REQUIRED_PERMISSIONS.includes(userPermission as (typeof REQUIRED_PERMISSIONS)[number]);
    const isRepoOwner = triggeringUser.login === repoOwner;
    
    if (!hasRequiredPermission && !isRepoOwner) {
      throw new Error(`User does not have sufficient permissions to trigger AI reviews. Required: ${REQUIRED_PERMISSIONS.join(' or ')}, Current: ${userPermission}`);
    }
    
    // Double-check permissions haven't changed during execution
    const revalidatedPermission = await checkUserPermissions(
      this.octokit,
      repoOwner,
      this.context.repo.repo,
      triggeringUser.login
    );
    
    if (revalidatedPermission !== userPermission) {
      throw new Error(`Permission level changed during execution. Original: ${userPermission}, Current: ${revalidatedPermission}`);
    }
    
    Logger.userPermissionsPassed();
  }

  async processAndReviewDiff(): Promise<{ comments: ReviewComment[]; tokens: TokenUsage; fileChanges: FileChange[]; incrementalMessage?: string }> {
    Logger.diffProcessing();
    
    const pr = this.context.payload.pull_request as PullRequest;
    if (!pr) {
      throw new Error('Pull request not found in context');
    }

    // Always handle incremental reviews (simplified approach)
    const reviewState = await getReviewState(this.octokit, this.context, pr);
    const incrementalDiff = await getIncrementalDiff(
      this.octokit, 
      this.context, 
      pr, 
      reviewState?.lastReviewedSha
    );
    
    const incrementalResult = processIncrementalDiff(incrementalDiff, this.config);
    
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
    let repositoryContext: RepositoryContext | undefined;
    try {
      repositoryContext = await getRepositoryContext(this.octokit, this.context, pr);
      core.info(`📁 Repository context gathered: ${repositoryContext.structure.totalFiles} files`);
    } catch (error) {
      core.warning(`Failed to get repository context: ${error}`);
      // Continue with basic diff review if context fails
    }
    
    // Always create chunks with contextual content (±100 lines strategy)
    const chunks = await chunkDiff(
      incrementalDiff.changedFiles,
      this.config,
      repositoryContext,
      this.octokit,
      this.context,
      pr.head.sha
    );
    
    Logger.chunksCreated(chunks.length);

    if (chunks.length === 0) {
      Logger.noFilesToReview();
      return { 
        comments: [], 
        tokens: { input: 0, output: 0 }, 
        fileChanges: incrementalDiff.changedFiles,
        incrementalMessage
      };
    }

    Logger.reviewStart();
    
    let allComments: ReviewComment[] = [];
    let totalTokens: TokenUsage = { input: 0, output: 0 };

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkNumber = i + 1;
      
      Logger.chunkReview(chunkNumber, chunks.length, chunk.content.length, chunk.fileChanges.map(f => f.filename));
      Logger.aiProviderCall(chunkNumber, this.inputs.aiProvider, this.inputs.model);
      
      const startTime = Date.now();
      const { comments, tokens } = await reviewChunk(
        chunk,
        this.config,
        this.inputs.aiProvider,
        this.inputs.model
      );
      const duration = Date.now() - startTime;

      Logger.chunkResults(chunkNumber, comments.length, tokens.input, tokens.output, duration);
      Logger.chunkIssues(chunkNumber, comments);

      allComments = allComments.concat(comments);
      totalTokens = accumulateTokens(totalTokens, tokens);
    }

    // Always save review state for incremental reviews
    if (incrementalDiff.newCommits.length > 0) {
      const newReviewState: ReviewState = {
        prNumber: this.context.payload.pull_request?.number || 0,
        lastReviewedSha: pr.head.sha,
        reviewedCommits: incrementalDiff.newCommits,
        timestamp: new Date().toISOString()
      };
      
      await saveReviewState(this.octokit, this.context, pr, newReviewState);
      core.info(`💾 Review state saved for commit: ${pr.head.sha.substring(0, 7)}`);
    }

    Logger.totalResults(allComments.length, totalTokens.input, totalTokens.output);
    return { 
      comments: allComments, 
      tokens: totalTokens, 
      fileChanges: incrementalDiff.changedFiles,
      incrementalMessage
    };
  }

  async processAndPostComments(
    allComments: ReviewComment[],
    totalTokens: TokenUsage,
    modifiedFiles: string[],
    pr: PullRequest,
    triggeringUser: User,
    fileChanges: FileChange[],
    incrementalMessage?: string
  ): Promise<void> {
    Logger.commentProcessing();
    
    // Log severity breakdown
    const severityCounts = allComments.reduce((acc, comment) => {
      acc[comment.severity] = (acc[comment.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    Logger.severityBreakdown(severityCounts);
    
    const finalComments = processComments(allComments, this.config);
    Logger.finalComments(finalComments.length, allComments.length);
    
    if (finalComments.length !== allComments.length) {
      Logger.filteringReasons(this.config.max_comments);
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

    let reviewBody = formatReviewBody(
      this.inputs.model,
      totalTokens,
      finalComments.length,
      prInfo
    );
    
    // Prepend incremental message if available
    if (incrementalMessage) {
      reviewBody = `${incrementalMessage}\n\n${reviewBody}`;
    }

    if (finalComments.length > 0) {
      Logger.postingReview(reviewBody.length, finalComments.length);
      
      const postStartTime = Date.now();
      await postReview(
        this.octokit,
        this.context,
        pr,
        finalComments,
        reviewBody,
        fileChanges
      );
      const postDuration = Date.now() - postStartTime;
      
      Logger.reviewPosted(finalComments.length, postDuration);
    } else {
      Logger.summaryOnly(reviewBody.length);
      
      const postStartTime = Date.now();
      await postReview(this.octokit, this.context, pr, [], reviewBody, fileChanges);
      const postDuration = Date.now() - postStartTime;
      
      Logger.summaryPosted(postDuration);
    }
  }

  async reportCosts(totalTokens: TokenUsage): Promise<void> {
    Logger.costCalculation();
    
    try {
      // Use dynamic cost calculation with real-time pricing and secure credential management
      const cost = await calculateCost(
        totalTokens,
        this.inputs.model,
        this.inputs.aiProvider
      );
      Logger.costSummary(cost.totalCost, cost.inputCost, cost.outputCost);
      Logger.costBreakdown(totalTokens, cost.inputCost, cost.outputCost, cost.totalCost);
    } catch (error) {
      console.error(`Cost calculation failed: ${error}`);
      console.log(`Token usage - Input: ${totalTokens.input}, Output: ${totalTokens.output}`);
      console.log('Ensure API keys are valid and models are supported by the provider.');
    }
  }
}