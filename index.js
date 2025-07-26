const core = require("@actions/core");
const github = require("@actions/github");
const yaml = require("js-yaml");
const fs = require("fs");

// Default configuration
const DEFAULT_CONFIG = {
  review_prompt: `You are an AI code reviewer. Review this code for:
- Bugs and potential issues
- Security vulnerabilities
- Performance problems
- Code quality and best practices
- Architecture and design improvements
Be constructive and specific. Suggest improvements.`,
  max_comments: 15,
  prioritize_by_severity: true,
  review_aspects: [
    "bugs",
    "security_vulnerabilities",
    "performance_issues",
    "code_quality",
    "best_practices",
    "architecture_suggestions",
  ],
  ignore_patterns: [],
};

// Model pricing (per 1M tokens)
const MODEL_PRICING = {
  "claude-4": { input: 3.0, output: 15.0 },
  "claude-4-opus": { input: 15.0, output: 75.0 },
};

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

    // Get PR information
    const octokit = github.getOctokit(githubToken);
    const context = github.context;

    if (!context.payload.pull_request) {
      core.setFailed("This action only works on pull requests");
      return;
    }

    const pr = context.payload.pull_request;

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
    core.setFailed(`Action failed: ${error.message}`);
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
  const prompt = `${config.review_prompt}

Please review the following code changes and provide feedback as a JSON array of comments.
Each comment should have:
- file: the filename
- line: the line number (from the diff)
- severity: "critical", "major", "minor", or "suggestion"
- category: one of ${config.review_aspects.join(", ")}
- comment: your feedback

Code changes:
${chunk}

Respond with ONLY a JSON array, no other text.`;

  let response;
  let inputTokens = Math.ceil(prompt.length / 4); // rough estimate
  let outputTokens = 0;

  if (provider === "anthropic") {
    response = await callAnthropic(prompt, config.model, apiKey);
  } else if (provider === "openrouter") {
    response = await callOpenRouter(prompt, config.model, apiKey);
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  outputTokens = Math.ceil(response.length / 4); // rough estimate

  // Parse response
  let comments = [];
  try {
    comments = JSON.parse(response);
  } catch (e) {
    core.warning("Failed to parse AI response as JSON");
    comments = [];
  }

  return { comments, inputTokens, outputTokens };
}

async function callAnthropic(prompt, model, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callOpenRouter(prompt, model, apiKey) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/gundurraga/bad-buggy",
        "X-Title": "bad-buggy",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
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
  // Calculate cost
  const pricing = MODEL_PRICING[model] || MODEL_PRICING["claude-4"];
  const inputCost = (totalTokens.input / 1000000) * pricing.input;
  const outputCost = (totalTokens.output / 1000000) * pricing.output;
  const totalCost = inputCost + outputCost;

  let reviewBody = `🐰 bad-buggy review completed with ${comments.length} comments\n\n`;
  reviewBody += `**Review Cost:**\n`;
  reviewBody += `- Model: ${model}\n`;
  reviewBody += `- Total cost: ${totalCost.toFixed(4)}\n`;
  reviewBody += `- Tokens: ${totalTokens.input.toLocaleString()} input, ${totalTokens.output.toLocaleString()} output`;

  if (comments.length === 0) {
    reviewBody = `🐰 bad-buggy found no issues! Great job! 🎉\n\n${reviewBody}`;
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
    comments: comments.map((c) => ({
      path: c.file,
      line: c.line || 1,
      body: `**${c.severity}** (${c.category}): ${c.comment}`,
    })),
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
          body: `**${comment.file}**: ${comment.comment}`,
        });
      } catch (e) {
        core.error(`Failed to post comment: ${e.message}`);
      }
    }
  }
}

function reportCost(model, tokens) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING["claude-4"];
  const inputCost = (tokens.input / 1000000) * pricing.input;
  const outputCost = (tokens.output / 1000000) * pricing.output;
  const totalCost = inputCost + outputCost;

  core.info("=== Bad Buggy Cost Summary ===");
  core.info(`Model: ${model}`);
  core.info(`Input tokens: ${tokens.input.toLocaleString()}`);
  core.info(`Output tokens: ${tokens.output.toLocaleString()}`);
  core.info(`Total cost: $${totalCost.toFixed(4)}`);
  core.info("============================");
}

// Run the action
run();
