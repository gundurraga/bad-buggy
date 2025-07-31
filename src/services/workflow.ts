import * as github from '@actions/github';
import { ActionInputs, ReviewConfig, TokenUsage, ReviewComment, PullRequest, User, FileChange } from '../types';
import { validateInputs, validateConfig, validateAndThrow } from '../validation';
import { validateSecurity } from '../domains/security';
import { chunkDiff, processComments } from '../domains/review';
import { calculateCost, accumulateTokens } from '../domains/cost';
import { formatReviewBody } from '../domains/github';
import { getPRDiff, postReview, checkUserPermissions } from '../effects/github-api';
import { reviewChunk } from './ai-review';
import { Logger } from './logger';

/**
 * Workflow orchestrator for the AI code review process
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
    
    const userPermission = await checkUserPermissions(
      this.octokit,
      repoOwner,
      this.context.repo.repo,
      triggeringUser.login
    );
    
    Logger.userPermissionLevel(userPermission);

    if (
      !['admin', 'write'].includes(userPermission) &&
      triggeringUser.login !== repoOwner
    ) {
      throw new Error('User does not have sufficient permissions to trigger AI reviews');
    }
    
    Logger.userPermissionsPassed();
  }

  async processAndReviewDiff(): Promise<{ comments: ReviewComment[]; tokens: TokenUsage; fileChanges: FileChange[] }> {
    Logger.diffProcessing();
    
    const pr = this.context.payload.pull_request as PullRequest;
    if (!pr) {
      throw new Error('Pull request not found in context');
    }
    
    const diff = await getPRDiff(this.octokit, this.context, pr);
    const chunks = chunkDiff(diff, this.config);
    
    Logger.chunksCreated(chunks.length);

    if (chunks.length === 0) {
      Logger.noFilesToReview();
      return { comments: [], tokens: { input: 0, output: 0 }, fileChanges: diff };
    }

    Logger.reviewStart();
    
    let allComments: ReviewComment[] = [];
    let totalTokens: TokenUsage = { input: 0, output: 0 };

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkNumber = i + 1;
      
      Logger.chunkReview(chunkNumber, chunks.length, chunk.content.length, chunk.files);
      Logger.aiProviderCall(chunkNumber, this.inputs.aiProvider, this.inputs.model);
      
      const startTime = Date.now();
      const { comments, tokens } = await reviewChunk(
        chunk,
        this.config,
        this.inputs.aiProvider,
        this.inputs.apiKey,
        this.inputs.model
      );
      const duration = Date.now() - startTime;

      Logger.chunkResults(chunkNumber, comments.length, tokens.input, tokens.output, duration);
      Logger.chunkIssues(chunkNumber, comments);

      allComments = allComments.concat(comments);
      totalTokens = accumulateTokens(totalTokens, tokens);
    }

    Logger.totalResults(allComments.length, totalTokens.input, totalTokens.output);
    return { comments: allComments, tokens: totalTokens, fileChanges: diff };
  }

  async processAndPostComments(
    allComments: ReviewComment[],
    totalTokens: TokenUsage,
    modifiedFiles: string[],
    pr: PullRequest,
    triggeringUser: User,
    fileChanges: FileChange[]
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
      Logger.filteringReasons(this.config.max_comments, this.config.prioritize_by_severity);
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

    const reviewBody = formatReviewBody(
      this.inputs.model,
      totalTokens,
      finalComments.length,
      prInfo
    );

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
    
    const cost = calculateCost(this.inputs.model, totalTokens);
    Logger.costSummary(cost.totalCost, cost.inputCost, cost.outputCost);
    Logger.costBreakdown(totalTokens, cost.inputCost, cost.outputCost, cost.totalCost);
  }
}