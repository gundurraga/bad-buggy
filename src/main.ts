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

Examples of correct JSON responses:

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
    "severity": "major", 
    "category": "bugs",
    "comment": "Race condition in payment processing. Multiple concurrent transactions can cause double-charging. IMPACT: Financial loss, customer complaints. IMMEDIATE ACTION: Add transaction locking or atomic operations."
  }
]

Code changes:
${chunk.content}

Respond with ONLY a JSON array, no other text. Do not include explanations, thinking, or any text outside the JSON array. Start your response with [ and end with ].`;

  core.info(`🔗 Calling AI provider: ${provider} with model: ${model}`);
  core.info(`📝 Prompt length: ${prompt.length} characters`);

  const response = await callAIProvider(provider, prompt, apiKey, model);

  core.info(`🤖 AI Response received: ${response.content.length} characters`);
  core.info(
    `📊 AI Response preview: "${response.content.substring(0, 200)}${
      response.content.length > 200 ? "..." : ""
    }"`
  );

  // Parse JSON response (like the old index.js version)
  let comments: ReviewComment[] = [];
  try {
    // Try to parse the full response first
    const parsedResponse = JSON.parse(response.content);
    comments = parsedResponse.map((comment: any) => ({
      path: comment.file,
      line: comment.line,
      end_line: comment.end_line,
      severity: comment.severity as ReviewComment['severity'],
      body: comment.comment
    }));
  } catch (e) {
    // If that fails, try to extract JSON from the response
    try {
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        comments = parsedResponse.map((comment: any) => ({
          path: comment.file,
          line: comment.line,
          end_line: comment.end_line,
          severity: comment.severity as ReviewComment['severity'],
          body: comment.comment
        }));
      } else {
        core.warning("Failed to parse AI response as JSON - no JSON array found");
        core.warning(`Response was: ${response.content.substring(0, 500)}...`);
        comments = [];
      }
    } catch (e2) {
      core.warning("Failed to parse AI response as JSON");
      core.warning(`Response was: ${response.content.substring(0, 500)}...`);
      comments = [];
    }
  }

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
    core.info(`📄 PR Description: ${pr.body ? pr.body.substring(0, 200) + (pr.body.length > 200 ? '...' : '') : 'No description provided'}`);
    core.info(`🔗 PR URL: ${pr.html_url}`);
    core.info(`🌿 Branch: ${pr.head.ref} → ${pr.base.ref}`);
    core.info(`📊 PR Stats: +${pr.additions || 0} -${pr.deletions || 0} changes in ${pr.changed_files || 0} files`);

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
        `🔍 Reviewing chunk ${i + 1}/${chunks.length} (${chunk.content.length} chars)`
      );
      core.info(`📁 Chunk ${i + 1} files: ${chunk.files ? chunk.files.join(', ') : 'N/A'}`);
      
      core.info(`🤖 Sending chunk ${i + 1} to AI provider: ${inputs.aiProvider}`);
      core.info(`🎯 Using model: ${inputs.model}`);
      
      const startTime = Date.now();
      const { comments, tokens } = await reviewChunk(
        chunk,
        config,
        inputs.aiProvider,
        inputs.apiKey,
        inputs.model
      );
      const duration = Date.now() - startTime;

      core.info(
        `📝 Chunk ${i + 1} results: ${comments.length} comments, ${
          tokens.input
        } input tokens, ${tokens.output} output tokens (${duration}ms)`
      );
      
      if (comments.length > 0) {
        core.info(`🔍 Chunk ${i + 1} found issues:`);
        comments.forEach((comment, idx) => {
           core.info(`  ${idx + 1}. [${comment.severity}] ${comment.path}:${comment.line} - ${comment.body.substring(0, 100)}${comment.body.length > 100 ? '...' : ''}`);
         });
      } else {
        core.info(`✅ Chunk ${i + 1}: No issues found`);
      }

      allComments = allComments.concat(comments);
      totalTokens = accumulateTokens(totalTokens, tokens);
    }

    core.info(
      `📊 Total review results: ${allComments.length} raw comments, ${totalTokens.input} input tokens, ${totalTokens.output} output tokens`
    );

    // Process and post comments
    core.info("🔄 Processing and filtering comments...");
    core.info(`📊 Raw comments by severity:`);
    const severityCounts = allComments.reduce((acc, comment) => {
      acc[comment.severity] = (acc[comment.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    Object.entries(severityCounts).forEach(([severity, count]) => {
      core.info(`  ${severity}: ${count} comments`);
    });
    
    const finalComments = processComments(allComments, config);
    core.info(
      `✨ Final comments after processing: ${finalComments.length} (filtered from ${allComments.length})`
    );
    
    if (finalComments.length !== allComments.length) {
      core.info(`🔽 Comments filtered due to:`);
      core.info(`  - Max comments limit: ${config.max_comments}`);
      core.info(`  - Severity prioritization: ${config.prioritize_by_severity}`);
    }

    // Prepare PR information for summary
    const prInfo = {
      title: typedPr.title,
      description: typedPr.body || '',
      author: triggeringUser.login,
      filesChanged: modifiedFiles,
      additions: typedPr.additions || 0,
      deletions: typedPr.deletions || 0
    };

    const reviewBody = formatReviewBody(
      inputs.model,
      totalTokens,
      finalComments.length,
      prInfo
    );

    if (finalComments.length > 0) {
      core.info("📤 Posting review to GitHub...");
      core.info(`📝 Review summary length: ${reviewBody.length} characters`);
      core.info(`💬 Individual comments to post: ${finalComments.length}`);
      
      const postStartTime = Date.now();
      await postReview(
        octokit,
        typedContext,
        typedPr,
        finalComments,
        reviewBody
      );
      const postDuration = Date.now() - postStartTime;
      core.info(`✅ Posted ${finalComments.length} review comments (${postDuration}ms)`);
    } else {
      core.info("ℹ️ No issues found in the code - posting summary comment");
      core.info(`📝 Summary-only review length: ${reviewBody.length} characters`);
      
      const postStartTime = Date.now();
      // Post a summary even when no issues found
      await postReview(octokit, typedContext, typedPr, [], reviewBody);
      const postDuration = Date.now() - postStartTime;
      core.info(`✅ Posted summary review (${postDuration}ms)`);
    }

    // Report cost
    core.info("💰 Calculating review costs...");
    const cost = calculateCost(inputs.model, totalTokens);
    const costMessage = `💰 AI Review Cost: ${formatCost(
      cost.totalCost
    )} (${formatCost(cost.inputCost)} input + ${formatCost(
      cost.outputCost
    )} output)`;
    core.info(costMessage);
    
    // Additional cost details
    core.info(`📊 Token breakdown:`);
    core.info(`  Input tokens: ${totalTokens.input} (${formatCost(cost.inputCost)})`);
    core.info(`  Output tokens: ${totalTokens.output} (${formatCost(cost.outputCost)})`);
    core.info(`  Total tokens: ${totalTokens.input + totalTokens.output}`);
    core.info(`💵 Cost per review: ${formatCost(cost.totalCost)}`);
    if (cost.totalCost > 0) {
      const reviewsPerDollar = Math.floor(1 / cost.totalCost);
      core.info(`📈 Reviews per dollar: ~${reviewsPerDollar}`);
    }

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
