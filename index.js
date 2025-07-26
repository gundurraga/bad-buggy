const core = require("@actions/core");
const github = require("@actions/github");

// Import our modular services
const { loadConfig } = require("./src/utils/config-loader");
const { CostCalculator } = require("./src/models/cost-calculator");
const { CommentProcessor } = require("./src/models/comment-processor");
const { AIProvider } = require("./src/services/ai-provider");
const { GitHubService } = require("./src/services/github-service");

async function run() {
  try {
    // Get inputs
    const githubToken = core.getInput("github-token", { required: true });
    const aiProvider = core.getInput("ai-provider", { required: true });
    const apiKey = core.getInput("api-key", { required: true });
    const model = core.getInput("model", { required: true });
    const configFile =
      core.getInput("config-file") || ".github/ai-review-config.yml";

    // Load configuration
    const config = await loadConfig(configFile);
    config.model = model; // Override with input model

    // Initialize services
    const octokit = github.getOctokit(githubToken);
    const context = github.context;

    const githubService = new GitHubService(octokit, context);
    const aiProviderService = new AIProvider(aiProvider, apiKey);
    const commentProcessor = new CommentProcessor(config);
    const costCalculator = new CostCalculator(model);

    // Validate PR context
    if (!context.payload.pull_request) {
      core.setFailed("This action only works on pull requests");
      return;
    }

    const pr = context.payload.pull_request;

    // Get PR diff
    const diff = await githubService.getPRDiff(pr, config);
    if (!diff) {
      core.warning("No diff found for this PR");
      return;
    }

    // Chunk the diff if needed
    const chunks = commentProcessor.chunkDiff(diff);

    // Review each chunk
    const allComments = [];
    let totalTokens = { input: 0, output: 0 };

    for (const chunk of chunks) {
      const review = await aiProviderService.reviewChunk(chunk, config);
      allComments.push(...review.comments);
      totalTokens.input += review.inputTokens;
      totalTokens.output += review.outputTokens;
    }

    // Process and filter comments
    const finalComments = commentProcessor.process(allComments);

    // Calculate costs
    const costSummary = costCalculator.formatCostSummary(totalTokens);

    // Post review to GitHub
    await githubService.postReview(pr, finalComments, costSummary.summary);

    // Report cost to logs
    core.info(costSummary.logSummary);

    core.info(`Review completed: ${finalComments.length} comments posted`);
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

// Run the action
run();
