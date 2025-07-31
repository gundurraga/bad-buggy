const core = require("@actions/core");
const github = require("@actions/github");
const yaml = require("js-yaml");
const fs = require("fs");
const {
  callAIProvider,
  AIProviderError,
} = require("./src/providers/ai-providers");
const {
  validateConfig,
  validateInputs,
  ConfigValidationError,
} = require("./src/utils/config-validator");
const { DEFAULT_CONFIG } = require("./src/config/default-config");
const { performSecurityCheck } = require("./src/security/access-control");

// Model pricing (per 1M tokens)
const MODEL_PRICING = {
  "claude-4": { input: 3.0, output: 15.0 },
  "claude-4-opus": { input: 15.0, output: 75.0 },
};

function countTokens(text, model) {
  // Simple character-based estimation that works for all models
  // This is accurate enough for cost tracking purposes
  let avgCharsPerToken = 3.5; // Default conservative estimate

  // Adjust based on model type (rough estimates)
  if (model.includes("claude")) {
    avgCharsPerToken = 3.8; // Claude tends to have slightly longer tokens
  } else if (model.includes("gpt-4")) {
    avgCharsPerToken = 3.2; // GPT-4 is more efficient
  } else if (model.includes("gpt-3")) {
    avgCharsPerToken = 3.0; // GPT-3 models
  }

  return Math.ceil(text.length / avgCharsPerToken);
}

function calculateCost(model, tokens) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING["claude-4"];
  const inputCost = (tokens.input / 1000000) * pricing.input;
  const outputCost = (tokens.output / 1000000) * pricing.output;
  const totalCost = inputCost + outputCost;
  return { inputCost, outputCost, totalCost, pricing };
}

async function run() {
  try {
    // Get inputs
    const githubToken = core.getInput("github-token", { required: true });
    const aiProvider = core.getInput("ai-provider", { required: true });
    const apiKey = core.getInput("api-key", { required: true });
    const model = core.getInput("model", { required: true });
    const configFile =
      core.getInput("config-file") || ".github/ai-review-config.yml";

    // Validate inputs
    validateInputs({ githubToken, aiProvider, apiKey, model });

    // Load and validate configuration
    const config = await loadConfig(configFile);
    config.model = model; // Override with input model
    validateConfig(config);

    // Get PR information
    const octokit = github.getOctokit(githubToken);
    const context = github.context;

    if (!context.payload.pull_request) {
      core.setFailed("This action only works on pull requests");
      return;
    }

    const pr = context.payload.pull_request;

    // COMPREHENSIVE SECURITY CHECK for public repositories
    const securityCheck = await performSecurityCheck(
      octokit,
      context,
      pr,
      config
    );
    if (!securityCheck.allowed) {
      core.info(`Review skipped: ${securityCheck.reason}`);
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: pr.number,
        body: `🔒 ${securityCheck.message}`,
      });
      return;
    }

    // Get PR diff
    const diff = await getPRDiff(octokit, context, pr, config);

    // Chunk the diff if needed
    const chunks = chunkDiff(diff, config);

    // Review each chunk
    const reviews = [];
    let totalCost = { input: 0, output: 0 };

    for (const chunk of chunks) {
      const review = await reviewChunk(chunk, config, aiProvider, apiKey);
      reviews.push(...review.comments);
      totalCost.input += review.inputTokens;
      totalCost.output += review.outputTokens;
    }

    // Sort and limit comments
    const finalComments = processComments(reviews, config);

    // Post review
    await postReview(
      octokit,
      context,
      pr,
      finalComments,
      config.model,
      totalCost
    );

    // Report cost (to console logs)
    reportCost(config.model, totalCost);
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      core.setFailed(`Configuration error: ${error.message}`);
    } else {
      core.setFailed(`Action failed: ${error.message}`);
    }
  }
}

async function loadConfig(configFile) {
  try {
    const configContent = fs.readFileSync(configFile, "utf8");
    const userConfig = yaml.load(configContent);
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch (error) {
    core.info(`No config file found at ${configFile}, using defaults`);
    return DEFAULT_CONFIG;
  }
}

async function getPRDiff(octokit, context, pr, config) {
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pr.number,
  });

  let diff = "";
  for (const file of files) {
    // Skip ignored files
    if (shouldIgnoreFile(file.filename, config)) continue;

    diff += `\n\n--- File: ${file.filename} ---\n`;
    diff += `Status: ${file.status}\n`;
    diff += `Changes: +${file.additions} -${file.deletions}\n`;
    if (file.patch) {
      diff += file.patch;
    }
  }

  return diff;
}

function shouldIgnoreFile(filename, config) {
  // Simple pattern matching - could be enhanced
  const ignorePatterns = config.ignore_patterns || [];
  for (const pattern of ignorePatterns) {
    if (filename.includes(pattern.replace("*", ""))) {
      return true;
    }
  }
  return false;
}

function chunkDiff(diff, config) {
  // Simple chunking by size - aim for ~4000 tokens per chunk
  const MAX_CHUNK_SIZE = 12000; // characters, roughly 3000 tokens
  const chunks = [];

  if (diff.length <= MAX_CHUNK_SIZE) {
    return [diff];
  }

  // Split by files
  const files = diff.split("\n\n--- File:");
  let currentChunk = "";

  for (const file of files) {
    if (currentChunk.length + file.length > MAX_CHUNK_SIZE) {
      chunks.push(currentChunk);
      currentChunk = "--- File:" + file;
    } else {
      currentChunk += "\n\n--- File:" + file;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function reviewChunk(chunk, config, provider, apiKey) {
  const prompt = `${config.review_prompt.replace(
    "{{DATE}}",
    new Date().toISOString().split("T")[0]
  )}

Please review the following code changes and provide feedback as a JSON array of comments.
Each comment should have:
- file: the filename
- line: the line number (from the diff)
- end_line: (optional) the end line for multi-line comments
- severity: "critical", "major", "minor", or "suggestion"
- category: one of ${config.review_aspects.join(", ")}
- comment: your feedback

Examples of correct JSON responses (only for CRITICAL issues):

[
  {
    "file": "src/auth.js",
    "line": 45,
    "severity": "critical",
    "category": "security_vulnerabilities",
    "comment": "CRITICAL: SQL injection vulnerability. User input 'userInput' is directly concatenated into query without sanitization. IMPACT: Database compromise, data theft. IMMEDIATE ACTION: Use parameterized queries or ORM methods."
  },
  {
    "file": "src/payment.js", 
    "line": 78,
    "end_line": 85,
    "severity": "critical", 
    "category": "bugs",
    "comment": "CRITICAL: Race condition in payment processing. Multiple concurrent transactions can cause double-charging. IMPACT: Financial loss, customer complaints. IMMEDIATE ACTION: Add transaction locking or atomic operations."
  }
]

Code changes:
${chunk}

Respond with ONLY a JSON array, no other text. Do not include explanations, thinking, or any text outside the JSON array. Start your response with [ and end with ].`;

  let response;
  let inputTokens = countTokens(prompt, config.model);
  let outputTokens = 0;

  try {
    response = await callAIProvider(provider, prompt, config.model, apiKey);
    outputTokens = countTokens(response, config.model);
  } catch (error) {
    if (error instanceof AIProviderError) {
      throw new Error(`${error.provider} provider error: ${error.message}`);
    }
    throw error;
  }

  // Parse response
  let comments = [];
  try {
    // Try to parse the full response first
    comments = JSON.parse(response);
  } catch (e) {
    // If that fails, try to extract JSON from the response
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        comments = JSON.parse(jsonMatch[0]);
      } else {
        core.warning(
          "Failed to parse AI response as JSON - no JSON array found"
        );
        comments = [];
      }
    } catch (e2) {
      core.warning("Failed to parse AI response as JSON");
      core.warning(`Response was: ${response.substring(0, 500)}...`);
      comments = [];
    }
  }

  return { comments, inputTokens, outputTokens };
}

function processComments(comments, config) {
  // Remove duplicates
  const unique = comments.filter(
    (comment, index, self) =>
      index ===
      self.findIndex((c) => c.file === comment.file && c.line === comment.line)
  );

  // Sort by severity if needed
  if (config.prioritize_by_severity) {
    const severityOrder = { critical: 0, major: 1, minor: 2, suggestion: 3 };
    unique.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
  }

  // Limit number of comments
  return unique.slice(0, config.max_comments);
}

async function postReview(octokit, context, pr, comments, model, totalTokens) {
  const { totalCost } = calculateCost(model, totalTokens);

  let reviewBody = `🐰 Bad Buggy review completed with ${comments.length} comments\n\n`;
  reviewBody += `**Review Cost:**\n`;
  reviewBody += `- Model: ${model}\n`;
  reviewBody += `- Total cost: $${totalCost.toFixed(4)} (equal to ${Math.round(
    1 / totalCost
  )} reviews per dollar)\n`;
  reviewBody += `- Tokens: ${totalTokens.input.toLocaleString()} input, ${totalTokens.output.toLocaleString()} output`;

  if (comments.length === 0) {
    reviewBody = `bad-buggy found no issues! Great job! 🎉\n\n${reviewBody}`;
    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: pr.number,
      body: reviewBody,
    });
    return;
  }

  // Create review
  const review = {
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pr.number,
    event: "COMMENT",
    body: reviewBody,
    comments: comments.map((c) => {
      const comment = {
        path: c.file,
        line: c.line || 1,
        body: `**${c.severity}** (${c.category}): ${c.comment}`,
      };
      if (c.end_line && c.end_line > c.line) {
        comment.start_line = c.line;
        comment.line = c.end_line;
      }
      return comment;
    }),
  };

  try {
    await octokit.rest.pulls.createReview(review);
    core.info(`Posted ${comments.length} review comments`);
  } catch (error) {
    core.error(`Failed to post review: ${error.message}`);
    // Fall back to posting as individual comments
    for (const comment of comments) {
      try {
        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: pr.number,
          body: `**${comment.file}:${comment.line}${
            comment.end_line ? `-${comment.end_line}` : ""
          }**: ${comment.comment}`,
        });
      } catch (e) {
        core.error(`Failed to post comment: ${e.message}`);
      }
    }
  }
}

function reportCost(model, tokens) {
  const { totalCost } = calculateCost(model, tokens);

  core.info("=== Bad Buggy Cost Summary ===");
  core.info(`Model: ${model}`);
  core.info(`Input tokens: ${tokens.input.toLocaleString()}`);
  core.info(`Output tokens: ${tokens.output.toLocaleString()}`);
  core.info(`Total cost: $${totalCost.toFixed(4)}`);
  core.info("============================");
}

// Run the action
run();
