import * as core from '@actions/core';
import * as github from '@actions/github';
import { ActionInputs, ReviewConfig, TokenUsage, ReviewComment } from './types';
import { loadConfig } from './config';
import { validateInputs, validateConfig, validateAndThrow } from './validation';
import { validateSecurity } from './domains/security';
import { chunkDiff, processComments, parseAIResponse, countTokens } from './domains/review';
import { calculateCost, accumulateTokens, formatCost } from './domains/cost';
import { formatReviewBody } from './domains/github';
import { callAIProvider } from './effects/ai-api';
import { getPRDiff, postReview, checkUserPermissions } from './effects/github-api';

// Pure function to get action inputs
const getActionInputs = (): ActionInputs => {
  return {
    githubToken: core.getInput('github-token', { required: true }),
    aiProvider: core.getInput('ai-provider', { required: true }) as 'anthropic' | 'openrouter',
    apiKey: core.getInput('api-key', { required: true }),
    model: core.getInput('model', { required: true }),
    configFile: core.getInput('config-file') || '.github/ai-review-config.yml'
  };
};

// Effect: Review a single chunk
const reviewChunk = async (
  chunk: any,
  config: ReviewConfig,
  provider: 'anthropic' | 'openrouter',
  apiKey: string,
  model: string
): Promise<{ comments: ReviewComment[]; tokens: TokenUsage }> => {
  const prompt = `${config.review_prompt}\n\nCode to review:\n${chunk.content}`;
  
  const response = await callAIProvider(provider, prompt, apiKey, model);
  const comments = parseAIResponse(response.content);
  
  const tokens: TokenUsage = response.usage ? {
    input: response.usage.input_tokens,
    output: response.usage.output_tokens
  } : {
    input: countTokens(prompt, model),
    output: countTokens(response.content, model)
  };
  
  return { comments, tokens };
};

// Main execution function
export const run = async (): Promise<void> => {
  try {
    // Get and validate inputs
    const inputs = getActionInputs();
    const inputValidation = validateInputs(inputs);
    validateAndThrow(inputValidation, 'Input validation failed');

    // Load and validate configuration
    const config = await loadConfig(inputs.configFile);
    const configValidation = validateConfig(config);
    validateAndThrow(configValidation, 'Configuration validation failed');

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
    const typedPr = pr as any;
    const typedContext = context as any;

    // Security check
    const diff = await getPRDiff(octokit, typedContext, typedPr);
    const modifiedFiles = diff.map(file => file.filename);
    
    const securityCheck = validateSecurity(typedPr, triggeringUser as any, repoOwner, config, modifiedFiles);
    
    if (!securityCheck.allowed) {
      core.setFailed(securityCheck.message || 'Security check failed');
      return;
    }

    // Check user permissions
    const userPermission = await checkUserPermissions(octokit, repoOwner, context.repo.repo, triggeringUser.login);
    if (!['admin', 'write'].includes(userPermission) && triggeringUser.login !== repoOwner) {
      core.setFailed('User does not have sufficient permissions to trigger AI reviews');
      return;
    }

    // Process diff
    const chunks = chunkDiff(diff, config);
    
    if (chunks.length === 0) {
      core.info('No files to review after applying ignore patterns');
      return;
    }

    // Review chunks and accumulate results
    let allComments: ReviewComment[] = [];
    let totalTokens: TokenUsage = { input: 0, output: 0 };

    for (const chunk of chunks) {
      const { comments, tokens } = await reviewChunk(chunk, config, inputs.aiProvider, inputs.apiKey, inputs.model);
      allComments = allComments.concat(comments);
      totalTokens = accumulateTokens(totalTokens, tokens);
    }

    // Process and post comments
    const finalComments = processComments(allComments, config);
    const reviewBody = formatReviewBody(inputs.model, totalTokens, finalComments.length);
    
    if (finalComments.length > 0) {
      await postReview(octokit, typedContext, typedPr, finalComments, reviewBody);
      core.info(`Posted ${finalComments.length} review comments`);
    } else {
      core.info('No issues found in the code');
    }

    // Report cost
    const cost = calculateCost(inputs.model, totalTokens);
    const costMessage = `AI Review Cost: ${formatCost(cost.totalCost)} (${formatCost(cost.inputCost)} input + ${formatCost(cost.outputCost)} output)`;
    core.info(costMessage);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action failed: ${errorMessage}`);
  }
};

// Execute if this is the main module
if (require.main === module) {
  run();
}