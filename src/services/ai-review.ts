import * as core from "@actions/core";
import {
  ReviewConfig,
  ReviewComment,
  TokenUsage,
  DiffChunk,
  RepositoryContext,
} from "../types";
import { callAIProvider } from "../effects/ai-api";
import { countTokens } from "../domains/review";

/**
 * Service for handling Bad Buggy-powered code review operations
 */

// Build review prompt with repository context and contextual content
export const buildReviewPrompt = (
  config: ReviewConfig,
  chunkContent: string,
  repositoryContext?: RepositoryContext
): string => {
  const basePrompt = config.review_prompt.replace(
    "{{DATE}}",
    new Date().toISOString().split("T")[0]
  );

  // Add custom prompt if provided
  const fullPrompt = config.custom_prompt 
    ? `${basePrompt}\n\nAdditional instructions: ${config.custom_prompt}`
    : basePrompt;

  let contextSection = "";

  // Always include repository context if available
  if (repositoryContext) {
    contextSection += "\n## Repository Context\n\n";

    // Add project information
    if (repositoryContext.packageInfo) {
      contextSection += `### Project Information\n`;
      contextSection += `- Name: ${
        repositoryContext.packageInfo.name || "Unknown"
      }\n`;
      contextSection += `- Version: ${
        repositoryContext.packageInfo.version || "Unknown"
      }\n`;
      if (repositoryContext.packageInfo.description) {
        contextSection += `- Description: ${repositoryContext.packageInfo.description}\n`;
      }
      contextSection += "\n";
    }

    // Add repository structure overview
    if (repositoryContext.structure) {
      contextSection += `### Repository Structure\n`;
      contextSection += `- Total Files: ${repositoryContext.structure.totalFiles}\n`;

      const languages = Object.entries(repositoryContext.structure.languages)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([ext, count]) => `${ext} (${count})`)
        .join(", ");

      if (languages) {
        contextSection += `- Main Languages: ${languages}\n`;
      }

      // Add key directories (limit to avoid token overflow)
      const keyDirs = repositoryContext.structure.directories
        .filter((dir) => !dir.includes("node_modules") && !dir.includes(".git"))
        .slice(0, 15)
        .join(", ");

      if (keyDirs) {
        contextSection += `- Key Directories: ${keyDirs}\n`;
      }

      contextSection += "\n";
    }
  }

  return `${fullPrompt}${contextSection}

Please review the following code changes and provide feedback as a JSON array of comments.
Each comment should have:
- file: the filename
- line: the line number (from the diff)
- end_line: (optional) the end line for multi-line comments
- severity: "critical", "major", or "suggestion"
- comment: your feedback

Examples of correct JSON responses:

[
  {
    "file": "src/auth.js",
    "line": 45,
    "end_line": 65,
    "severity": "critical",
    "comment": "CRITICAL: SQL injection vulnerability. User input 'userInput' is directly concatenated into query without sanitization. IMPACT: Database compromise, data theft. IMMEDIATE ACTION: Use parameterized queries or ORM methods."
  },
  {
    "file": "src/payment.js", 
    "line": 78,
    "end_line": 85,
    "severity": "major", 
    "comment": "Race condition in payment processing. Multiple concurrent transactions can cause double-charging. IMPACT: Financial loss, customer complaints. IMMEDIATE ACTION: Add transaction locking or atomic operations."
  }
]

Code changes:
${chunkContent}

Respond with ONLY a JSON array, no other text. Do not include explanations, thinking, or any text outside the JSON array. Start your response with [ and end with ].`;
};



// Helper function to validate severity
const isValidSeverity = (
  severity: string
): severity is ReviewComment["severity"] => {
  return ["critical", "major", "suggestion"].includes(severity);
};

// Pure function to parse AI response into ReviewComments
export const parseAIResponse = (responseContent: string): ReviewComment[] => {
  let comments: ReviewComment[] = [];

  try {
    // Try to parse the full response first
    const parsedResponse = JSON.parse(responseContent);
    comments = parsedResponse.map(
      (comment: {
        file: string;
        line: number;
        end_line?: number;
        severity: string;
        comment: string;
      }) => {
        if (!isValidSeverity(comment.severity)) {
          core.warning(
            `Invalid severity '${comment.severity}' found, defaulting to 'suggestion'`
          );
          comment.severity = "suggestion";
        }
        return {
          path: comment.file,
          line: comment.line,
          end_line: comment.end_line,
          severity: comment.severity as ReviewComment["severity"],
          body: comment.comment,
        };
      }
    );
  } catch (e) {
    // If that fails, try to extract JSON from the response
    try {
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        comments = parsedResponse.map(
          (comment: {
            file: string;
            line: number;
            end_line?: number;
            severity: string;
            comment: string;
          }) => {
            if (!isValidSeverity(comment.severity)) {
              core.warning(
                `Invalid severity '${comment.severity}' found, defaulting to 'suggestion'`
              );
              comment.severity = "suggestion";
            }
            return {
              path: comment.file,
              line: comment.line,
              end_line: comment.end_line,
              severity: comment.severity as ReviewComment["severity"],
              body: comment.comment,
            };
          }
        );
      } else {
        core.warning(
          "Failed to parse AI response as JSON - no JSON array found"
        );
        core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
        comments = [];
      }
    } catch (e2) {
      core.warning("Failed to parse AI response as JSON");
      core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
      comments = [];
    }
  }

  return comments;
};

// Effect: Review a single chunk with repository context
export const reviewChunk = async (
  chunk: DiffChunk,
  config: ReviewConfig,
  provider: "anthropic" | "openrouter",
  apiKey: string,
  model: string
): Promise<{ comments: ReviewComment[]; tokens: TokenUsage }> => {
  // Always use repository context if available (simplified approach)
  const prompt = buildReviewPrompt(
    config,
    chunk.content,
    chunk.repositoryContext
  );

  core.info(`🔗 Calling AI provider: ${provider} with model: ${model}`);
  core.info(`📝 Prompt length: ${prompt.length} characters`);
  if (chunk.repositoryContext) {
    core.info(`🏗️ Using repository context with structure`);
  }
  if (chunk.contextualContent) {
    const fileCount = Object.keys(chunk.contextualContent).length;
    core.info(`📄 Including contextual content for ${fileCount} files`);
  }

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