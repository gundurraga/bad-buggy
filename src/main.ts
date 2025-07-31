import * as core from "@actions/core";
import * as github from "@actions/github";
import { ActionInputs } from "./types";
import { loadConfig } from "./config";
import { ReviewWorkflow } from "./services/workflow";
import { Logger } from "./services/logger";

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



// Main execution function
export const run = async (): Promise<void> => {
  try {
    Logger.startup();

    // Get and validate inputs
    const inputs = getActionInputs();
    Logger.inputs(inputs.aiProvider, inputs.model, inputs.configFile);

    // Load and validate configuration
    Logger.configLoading(inputs.configFile);
    const config = await loadConfig(inputs.configFile);
    Logger.configLoaded(config.max_comments, config.prioritize_by_severity);

    // Initialize GitHub client and context
    const octokit = github.getOctokit(inputs.githubToken);
    const context = github.context;
    Logger.githubInit(context.repo.owner, context.repo.repo, context.eventName);

    // Create workflow orchestrator
    const workflow = new ReviewWorkflow(octokit, context, inputs, config);

    // Execute workflow steps
    await workflow.validateInputs();
    await workflow.validateConfig();
    
    const { pr, triggeringUser, repoOwner } = await workflow.validatePullRequest();
    const modifiedFiles = await workflow.performSecurityChecks(pr, triggeringUser, repoOwner);
    await workflow.checkUserPermissions(triggeringUser, repoOwner);
    
    const { comments, tokens } = await workflow.processAndReviewDiff();
    
    if (comments.length === 0 && tokens.input === 0) {
      return; // No files to review
    }
    
    await workflow.processAndPostComments(comments, tokens, modifiedFiles, pr, triggeringUser);
    await workflow.reportCosts(tokens);

    Logger.completion();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.error(errorMessage);
  }
};

// Execute if this is the main module
if (require.main === module) {
  run();
}
