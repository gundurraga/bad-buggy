import * as core from "@actions/core";
import {
  ReviewConfig,
  ReviewComment,
  TokenUsage,
  DiffChunk,
  RepositoryContext,
} from "../types";

interface AICommentInput {
  file: string;
  line?: number; // Optional for file-level comments
  start_line?: number; // For multi-line comments
  comment: string;
}
import { callAIProvider } from "../effects/ai-api";
import { countTokens } from "../domains/review";
import { TokenCounterFactory } from "./token-counter";

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

Please review the following code changes and provide maximum your top 1-5 most impactful insights as a JSON array.

Each comment can be either:
1. **Single-line comment** (specific to one diff line):
   - file: the filename
   - line: the line number (from the diff)
   - comment: your insight

2. **Multi-line comment** (spans multiple diff lines):
   - file: the filename
   - start_line: the first line number
   - line: the last line number  
   - comment: your insight

3. **File-level comment** (general file feedback):
   - file: the filename
   - comment: your insight (omit line/start_line for file-level comments)

Examples of senior engineer feedback with markdown formatting:

[
  {
    "file": "src/auth.js",
    "line": 45,
    "comment": "**Security vulnerability: SQL injection risk**\n\nYour current approach uses direct string concatenation with user input, which creates a serious security vulnerability that could lead to database compromise.\n\n**Solution**: Use parameterized queries:\n\n\`\`\`sql\n-- Instead of:\nSELECT * FROM users WHERE id = '" + userId + "'\n\n-- Use:\nSELECT * FROM users WHERE id = ?\n\`\`\`\n\nThis follows OWASP guidelines and is a critical security practice that prevents attackers from injecting malicious SQL code."
  },
  {
    "file": "src/payment.js", 
    "start_line": 78,
    "line": 85,
    "comment": "**Great use of the Strategy pattern!**\n\nYour implementation is clean and follows good design principles. One enhancement to consider:\n\n**Add transaction locking** to prevent race conditions during concurrent payment processing:\n\n\`\`\`javascript\nconst lock = await acquirePaymentLock(userId);\ntry {\n  // Your payment processing logic\n} finally {\n  await releaseLock(lock);\n}\n\`\`\`\n\nThis would make the system more robust under high load and prevent double-charging scenarios."
  },
  {
    "file": "src/config.ts",
    "comment": "**Excellent configuration architecture!**\n\nThis file demonstrates good separation of concerns with environment-based configuration. Consider adding:\n\n1. **Configuration validation** using a schema library like Joi or Yup\n2. **Type safety** with strict TypeScript interfaces\n3. **Default fallbacks** for optional configuration values\n\nThis would make the configuration more robust and easier to maintain as the application grows."
  }
]

Code changes:
${chunkContent}

Respond with ONLY a JSON array, no other text. Do not include explanations, thinking, or any text outside the JSON array. Start your response with [ and end with ].`;
};

// Helper function to validate comment structure
const isValidComment = (comment: unknown): comment is AICommentInput => {
  if (typeof comment !== 'object' || comment === null) {
    return false;
  }
  const obj = comment as Record<string, unknown>;
  return typeof obj.file === 'string' && 
         (obj.line === undefined || typeof obj.line === 'number') && 
         typeof obj.comment === 'string';
};

// Pure function to parse AI response into ReviewComments
export const parseAIResponse = (responseContent: string): ReviewComment[] => {
  let comments: ReviewComment[] = [];

  // First, clean up the response by removing common markdown formatting
  let cleanedResponse = responseContent.trim();
  
  // Remove markdown code blocks if present
  cleanedResponse = cleanedResponse.replace(/^```json\s*\n?/i, '');
  cleanedResponse = cleanedResponse.replace(/\n?```\s*$/i, '');
  cleanedResponse = cleanedResponse.replace(/^```\s*\n?/i, '');
  cleanedResponse = cleanedResponse.trim();

  try {
    // Try to parse the cleaned response first
    const parsedResponse = JSON.parse(cleanedResponse);
    comments = parsedResponse
      .filter((comment: unknown): comment is AICommentInput => {
        if (!isValidComment(comment)) {
          core.warning(`Invalid comment structure found, skipping: ${JSON.stringify(comment)}`);
          return false;
        }
        return true;
      })
      .map((comment: {
        file: string;
        line?: number;
        start_line?: number;
        comment: string;
      }) => {
        const reviewComment: ReviewComment = {
          path: comment.file,
          body: comment.comment,
          commentType: comment.line !== undefined || comment.start_line !== undefined ? 'diff' : 'file',
        };
        
        if (comment.line !== undefined) {
          reviewComment.line = comment.line;
        }
        
        if (comment.start_line !== undefined) {
          reviewComment.start_line = comment.start_line;
        }
        
        return reviewComment;
      });
  } catch (e) {
    // If that fails, try to extract JSON from the cleaned response
    try {
      // More robust JSON extraction - find the first [ and last ]
      const startIndex = cleanedResponse.indexOf('[');
      const lastIndex = cleanedResponse.lastIndexOf(']');
      
      if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
        const jsonString = cleanedResponse.substring(startIndex, lastIndex + 1);
        const parsedResponse = JSON.parse(jsonString);
        comments = parsedResponse
          .filter((comment: unknown): comment is AICommentInput => {
            if (!isValidComment(comment)) {
              core.warning(`Invalid comment structure found, skipping: ${JSON.stringify(comment)}`);
              return false;
            }
            return true;
          })
          .map((comment: {
            file: string;
            line?: number;
            start_line?: number;
            comment: string;
          }) => {
            const reviewComment: ReviewComment = {
              path: comment.file,
              body: comment.comment,
              commentType: comment.line !== undefined || comment.start_line !== undefined ? 'diff' : 'file',
            };
            
            if (comment.line !== undefined) {
              reviewComment.line = comment.line;
            }
            
            if (comment.start_line !== undefined) {
              reviewComment.start_line = comment.start_line;
            }
            
            return reviewComment;
          });
      } else {
        core.warning(
          "Failed to parse AI response as JSON - no JSON array found. The AI may have included text outside the JSON format."
        );
        core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
        core.info("💡 Tip: Check if the AI model is following the JSON format instructions in the prompt.");
        comments = [];
      }
    } catch (e2) {
      // Final fallback: try to find individual JSON objects
      try {
        const jsonMatches = cleanedResponse.match(/\{[^{}]*"file"[^{}]*\}/g);
        if (jsonMatches && jsonMatches.length > 0) {
          const parsedComments = jsonMatches
            .map(match => {
              try {
                return JSON.parse(match);
              } catch {
                return null;
              }
            })
            .filter((comment): comment is AICommentInput => comment && isValidComment(comment))
            .map((comment: {
              file: string;
              line?: number;
              start_line?: number;
              comment: string;
            }) => {
              const reviewComment: ReviewComment = {
                path: comment.file,
                body: comment.comment,
                commentType: comment.line !== undefined || comment.start_line !== undefined ? 'diff' : 'file',
              };
              
              if (comment.line !== undefined) {
                reviewComment.line = comment.line;
              }
              
              if (comment.start_line !== undefined) {
                reviewComment.start_line = comment.start_line;
              }
              
              return reviewComment;
            });
          
          if (parsedComments.length > 0) {
            core.info(`💡 Successfully recovered ${parsedComments.length} comments using fallback parsing.`);
            comments = parsedComments;
          } else {
            core.warning("Failed to parse AI response as JSON - the response may contain invalid JSON syntax.");
            core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
            core.info("💡 Tip: This could indicate the AI model isn't compatible with structured JSON responses. Consider using a different model.");
            comments = [];
          }
        } else {
          core.warning("Failed to parse AI response as JSON - the response may contain invalid JSON syntax.");
          core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
          core.info("💡 Tip: This could indicate the AI model isn't compatible with structured JSON responses. Consider using a different model.");
          comments = [];
        }
      } catch (e3) {
        core.warning("Failed to parse AI response as JSON - the response may contain invalid JSON syntax.");
        core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
        core.info("💡 Tip: This could indicate the AI model isn't compatible with structured JSON responses. Consider using a different model.");
        comments = [];
      }
    }
  }

  return comments;
};

// Effect: Review a single chunk with repository context using secure credential management
export const reviewChunk = async (
  chunk: DiffChunk,
  config: ReviewConfig,
  provider: "anthropic" | "openrouter",
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

  // Pre-request token estimation using provider-specific token counter with secure credentials
  let estimatedInputTokens = 0;
  try {
    const tokenCounter = TokenCounterFactory.create(provider);
    const tokenResult = await tokenCounter.countTokens(prompt, model);
    estimatedInputTokens = tokenResult.tokens;
    core.info(`🔢 Estimated input tokens: ${estimatedInputTokens}`);
  } catch (error) {
    core.warning(
      `Failed to get accurate token count, using fallback: ${error}`
    );
    estimatedInputTokens = countTokens(prompt, model);
  }

  const response = await callAIProvider(provider, prompt, model);

  core.info(`🤖 AI Response received: ${response.content.length} characters`);
  core.info(
    `📊 AI Response preview: "${response.content.substring(0, 200)}${
      response.content.length > 200 ? "..." : ""
    }"`
  );

  // Log enhanced usage information if available
  if (response.usage) {
    core.info(
      `📊 Token usage - Input: ${response.usage.input_tokens}, Output: ${response.usage.output_tokens}`
    );
    if (response.usage.cost) {
      core.info(`💰 Direct cost: $${response.usage.cost}`);
    }
    if (response.usage.cached_tokens) {
      core.info(`🗄️ Cached tokens: ${response.usage.cached_tokens}`);
    }
    if (response.usage.reasoning_tokens) {
      core.info(`🧠 Reasoning tokens: ${response.usage.reasoning_tokens}`);
    }
  }

  const comments = parseAIResponse(response.content);
  core.info(`💬 Parsed ${comments.length} comments from AI response`);

  const tokens: TokenUsage = response.usage
    ? {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      }
    : {
        input: estimatedInputTokens || countTokens(prompt, model),
        output: countTokens(response.content, model),
      };

  return { comments, tokens };
};
