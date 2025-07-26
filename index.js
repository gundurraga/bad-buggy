const core = require("@actions/core");
const github = require("@actions/github");
const yaml = require("js-yaml");
const fs = require("fs");

// Default configuration
const DEFAULT_CONFIG = {
  review_prompt: `ENHANCED CODE REVIEW PROMPT: Critical Analysis & Developer Assessment

CONTEXT: Today is ${
    new Date().toISOString().split("T")[0]
  }. Review with current best practices in mind.

MANDATORY FIRST STEP - IDENTIFY MOST CRITICAL ISSUE:
Priority 1: Functional failures (broken core functionality, data corruption risks, critical security vulnerabilities, memory leaks)
Priority 2: System stability (poor error handling, race conditions, performance bottlenecks)  
Priority 3: Maintainability blockers (architectural violations, tight coupling, code duplication)

Output format: "MOST CRITICAL ISSUE: [Category] - [Description]. IMPACT: [What breaks if unfixed]. IMMEDIATE ACTION: [Specific fix needed]."

EVALUATION FRAMEWORK:
- Functional Correctness: Requirements met, edge cases handled, input validation, boundary conditions
- Technical Implementation: Algorithm efficiency, architecture decisions, technology usage appropriately
- Code Quality: Readability (clear naming, formatting), documentation (explains why not just what), comprehensive error handling
- Testing & Reliability: Unit/integration tests, edge case coverage, proper mocking
- Security & Safety: Input sanitization, authentication checks, no hardcoded secrets

ANTIPATTERN DETECTION - Flag and educate on:
- God objects/functions (200+ line functions doing everything)
- Magic numbers/strings (use constants with descriptive names)
- Poor error handling (silent failures, swallowing exceptions)
- Tight coupling (changes requiring modifications across unrelated modules)
- Code duplication (repeated logic that should be abstracted)

COMMENT STRATEGY: Only add comments for genuinely critical issues that will impact functionality, security, or long-term maintainability. Skip minor style preferences unless they create real problems.`,
  max_comments: 8,
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
    "severity": "critical",
    "category": "bugs",
    "comment": "CRITICAL: Race condition in payment processing. Multiple concurrent transactions can cause double-charging. IMPACT: Financial loss, customer complaints. IMMEDIATE ACTION: Add transaction locking or atomic operations."
  }
]

Code changes:
${chunk}

Respond with ONLY a JSON array, no other text. Do not include explanations, thinking, or any text outside the JSON array. Start your response with [ and end with ].`;

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
