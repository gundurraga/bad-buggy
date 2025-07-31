import * as core from "@actions/core";
import * as github from "@actions/github";
import { ActionInputs, ReviewConfig, TokenUsage, ReviewComment } from "./types";
import { loadConfig } from "./config";
import { validateInputs, validateConfig, validateAndThrow } from "./validation";
import { validateSecurity } from "./domains/security";
import {
  chunkDiff,
  processComments,
  parseAIResponse,
  countTokens,
} from "./domains/review";
import { calculateCost, accumulateTokens, formatCost } from "./domains/cost";
import { formatReviewBody } from "./domains/github";
import { callAIProvider } from "./effects/ai-api";
import {
  getPRDiff,
  postReview,
  checkUserPermissions,
} from "./effects/github-api";

// Pure function to get action inputs
const getActionInputs = (): ActionInputs => {
  return {
    githubToken: core.getInput("github-token", { required: true }),
    aiProvider: core.getInput("ai-provider", { required: true }) as
      | "anthropic"
      | "openrouter",
    apiKey: core.getInput("api-key", { required: true }),
    model: core.getInput("model", { required: true }),
    configFile: core.getInput("config-file") || ".github/ai-review-config.yml",
  };
};

// Effect: Review a single chunk
const reviewChunk = async (
  chunk: any,
  config: ReviewConfig,
  provider: "anthropic" | "openrouter",
  apiKey: string,
  model: string
): Promise<{ comments: ReviewComment[]; tokens: TokenUsage }> => {
  const prompt = `${config.review_prompt}\n\nCode to review:\n${chunk.content}`;

  core.info(`🔗 Calling AI provider: ${provider} with model: ${model}`);
  core.info(`📝 Prompt length: ${prompt.length} characters`);

  const response = await callAIProvider(provider, prompt, apiKey, model);

  core.info(`🤖 AI Response received: ${response.content.length} characters`);
  core.info(
    `📊 AI Response preview: "${response.content.substring(0, 200)}${
      response.content.length > 200 ? "..." : ""
    }"`
  );

  const comments = parseAIResponse(response.content);
  core.info(`💬 Parsed ${comments.length} comments from AI response`);

  const tokens: TokenUsage = response.usage
    ? {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      }
    : {
        input: countTokens(prompt, model),
        output: countTokens(response.content, model),
      };

  return { comments, tokens };
};

// Main execution function
export const run = async (): Promise<void> => {
  try {
    core.info("🚀 Starting AI Code Review Action");

    // Get and validate inputs
    core.info("📋 Getting action inputs...");
    const inputs = getActionInputs();
    core.info(
      `✅ Inputs loaded: provider=${inputs.aiProvider}, model=${inputs.model}, config=${inputs.configFile}`
    );

    const inputValidation = validateInputs(inputs);
    validateAndThrow(inputValidation, "Input validation failed");
    core.info("✅ Input validation passed");

    // Load and validate configuration
    core.info(`📄 Loading configuration from ${inputs.configFile}...`);
    const config = await loadConfig(inputs.configFile);
    core.info(
      `✅ Configuration loaded: max_comments=${config.max_comments}, prioritize_by_severity=${config.prioritize_by_severity}`
    );

    const configValidation = validateConfig(config);
    validateAndThrow(configValidation, "Configuration validation failed");
    core.info("✅ Configuration validation passed");

    // Initialize GitHub client
    core.info("🔧 Initializing GitHub client...");
    const octokit = github.getOctokit(inputs.githubToken);
    const context = github.context;
    const pr = context.payload.pull_request;
    const triggeringUser = context.payload.sender;
    const repoOwner = context.repo.owner;

    core.info(
      `📊 GitHub context: repo=${context.repo.owner}/${context.repo.repo}, event=${context.eventName}`
    );

    if (!pr || !triggeringUser) {
      core.setFailed(
        "This action can only be run on pull requests with a valid sender"
      );
      return;
    }

    core.info(`📝 PR #${pr.number}: "${pr.title}" by ${triggeringUser.login}`);

    // Type assertion for GitHub context
    const typedPr = pr as any;
    const typedContext = context as any;

    // Security check
    core.info("🔒 Performing security checks...");
    const diff = await getPRDiff(octokit, typedContext, typedPr);
    const modifiedFiles = diff.map((file) => file.filename);
    core.info(
      `📁 Modified files (${modifiedFiles.length}): ${modifiedFiles.join(", ")}`
    );

    const securityCheck = validateSecurity(
      typedPr,
      triggeringUser as any,
      repoOwner,
      config,
      modifiedFiles
    );

    if (!securityCheck.allowed) {
      core.setFailed(securityCheck.message || "Security check failed");
      return;
    }
    core.info("✅ Security checks passed");

    // Check user permissions
    core.info(`👤 Checking permissions for user: ${triggeringUser.login}`);
    const userPermission = await checkUserPermissions(
      octokit,
      repoOwner,
      context.repo.repo,
      triggeringUser.login
    );
    core.info(`🔑 User permission level: ${userPermission}`);

    if (
      !["admin", "write"].includes(userPermission) &&
      triggeringUser.login !== repoOwner
    ) {
      core.setFailed(
        "User does not have sufficient permissions to trigger AI reviews"
      );
      return;
    }
    core.info("✅ User permissions verified");

    // Process diff
    core.info("📊 Processing diff and creating chunks...");
    const chunks = chunkDiff(diff, config);
    core.info(`📦 Created ${chunks.length} chunks for review`);

    if (chunks.length === 0) {
      core.info("⚠️ No files to review after applying ignore patterns");
      return;
    }

    // Review chunks and accumulate results
    core.info("🤖 Starting AI review process...");
    let allComments: ReviewComment[] = [];
    let totalTokens: TokenUsage = { input: 0, output: 0 };

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      core.info(
        `🔍 Reviewing chunk ${i + 1}/${chunks.length} (${
          chunk.content.length
        } chars)`
      );

      const { comments, tokens } = await reviewChunk(
        chunk,
        config,
        inputs.aiProvider,
        inputs.apiKey,
        inputs.model
      );

      core.info(
        `📝 Chunk ${i + 1} results: ${comments.length} comments, ${
          tokens.input
        } input tokens, ${tokens.output} output tokens`
      );

      allComments = allComments.concat(comments);
      totalTokens = accumulateTokens(totalTokens, tokens);
    }

    core.info(
      `📊 Total review results: ${allComments.length} raw comments, ${totalTokens.input} input tokens, ${totalTokens.output} output tokens`
    );

    // Process and post comments
    core.info("🔄 Processing and filtering comments...");
    const finalComments = processComments(allComments, config);
    core.info(
      `✨ Final comments after processing: ${finalComments.length} (filtered from ${allComments.length})`
    );

    const reviewBody = formatReviewBody(
      inputs.model,
      totalTokens,
      finalComments.length
    );

    if (finalComments.length > 0) {
      core.info("📤 Posting review to GitHub...");
      await postReview(
        octokit,
        typedContext,
        typedPr,
        finalComments,
        reviewBody
      );
      core.info(`✅ Posted ${finalComments.length} review comments`);
    } else {
      core.info("ℹ️ No issues found in the code - posting summary comment");
      // Post a summary even when no issues found
      await postReview(octokit, typedContext, typedPr, [], reviewBody);
    }

    // Report cost
    const cost = calculateCost(inputs.model, totalTokens);
    const costMessage = `💰 AI Review Cost: ${formatCost(
      cost.totalCost
    )} (${formatCost(cost.inputCost)} input + ${formatCost(
      cost.outputCost
    )} output)`;
    core.info(costMessage);

    core.info("🎉 AI Code Review completed successfully!");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action failed: ${errorMessage}`);
  }
};

// Execute if this is the main module
if (require.main === module) {
  run();
}
