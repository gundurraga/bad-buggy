import * as core from "@actions/core";
import {
  ReviewConfig,
  ReviewComment,
  TokenUsage,
  DiffChunk,
  RepositoryContext,
  PRContext,
} from "../types";

type AICommentInput = {
  file: string;
  line?: number; // Optional for file-level comments
  start_line?: number; // For multi-line comments
  comment: string;
};
import { callAIProvider } from "../effects/ai-api";
import { countTokens } from "../domains/review";
import { TokenCounterFactory } from "./token-counter";

// Helper function to categorize and prioritize existing comments
const categorizeAndPrioritizeComments = (
  comments: string[]
): {
  recent: string[];
  categories: {
    security: string[];
    performance: string[];
    architecture: string[];
    codeQuality: string[];
    other: string[];
  };
  alreadyCovered: string[];
} => {
  const categories = {
    security: [] as string[],
    performance: [] as string[],
    architecture: [] as string[],
    codeQuality: [] as string[],
    other: [] as string[],
  };

  const alreadyCovered: string[] = [];

  // Keywords for categorization
  const categoryKeywords = {
    security: [
      "security",
      "vulnerability",
      "injection",
      "authentication",
      "authorization",
      "sanitize",
      "validate",
    ],
    performance: [
      "performance",
      "bottleneck",
      "optimization",
      "memory",
      "cache",
      "token limit",
      "efficiency",
    ],
    architecture: [
      "architecture",
      "design pattern",
      "coupling",
      "cohesion",
      "separation",
      "interface",
      "abstraction",
    ],
    codeQuality: [
      "code quality",
      "maintainability",
      "readability",
      "naming",
      "complexity",
      "duplication",
    ],
  };

  // Implementation-specific patterns that indicate something is already covered
  const implementationPatterns = [
    /already implemented/i,
    /already exists/i,
    /truncation.*already/i,
    /validation.*already/i,
    /error handling.*already/i,
    /optimization.*already/i,
  ];

  comments.forEach((comment) => {
    const lowerComment = comment.toLowerCase();

    // Check if comment mentions something already implemented
    if (implementationPatterns.some((pattern) => pattern.test(comment))) {
      alreadyCovered.push(comment);
      return;
    }

    // Categorize by keywords
    let categorized = false;
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((keyword) => lowerComment.includes(keyword))) {
        categories[category as keyof typeof categories].push(comment);
        categorized = true;
        break;
      }
    }

    if (!categorized) {
      categories.other.push(comment);
    }
  });

  // Get most recent 5 comments for general context
  const recent = comments.slice(-5);

  return { recent, categories, alreadyCovered };
};

/**
 * Service for handling Bad Buggy-powered code review operations
 */

// Build review prompt with repository context and contextual content
export const buildReviewPrompt = (
  config: ReviewConfig,
  chunkContent: string,
  repositoryContext?: RepositoryContext,
  prContext?: PRContext
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

  // Add PR context if available
  if (prContext) {
    contextSection += "\n## Pull Request Context\n\n";
    contextSection += `**Title:** ${prContext.title}\n`;
    contextSection += `**Author:** ${prContext.author}\n`;
    if (prContext.description && prContext.description.trim()) {
      contextSection += `**Description:** ${prContext.description}\n`;
    }

    // Add categorized existing comments to provide better context and avoid repetition
    if (prContext.existingComments.length > 0) {
      const categorizedComments = categorizeAndPrioritizeComments(
        prContext.existingComments
      );

      contextSection += `\n## Previous Review Context\n\n`;

      // Show what's already been covered/implemented
      if (categorizedComments.alreadyCovered.length > 0) {
        contextSection += `**✅ Already Addressed:** These concerns have been noted as already implemented:\n`;
        categorizedComments.alreadyCovered
          .slice(0, 2)
          .forEach((comment, index) => {
            const preview =
              comment.length > 150
                ? comment.substring(0, 150) + "..."
                : comment;
            contextSection += `${index + 1}. ${preview}\n`;
          });
        contextSection += `\n`;
      }

      // Show categorized feedback to avoid repetition
      const nonEmptyCategories = Object.entries(
        categorizedComments.categories
      ).filter(([, comments]) => comments.length > 0);
      if (nonEmptyCategories.length > 0) {
        contextSection += `**Previous Feedback Categories:** (DO NOT repeat similar comments)\n`;
        nonEmptyCategories.slice(0, 3).forEach(([category, comments]) => {
          if (comments.length > 0) {
            const preview =
              comments[0].length > 120
                ? comments[0].substring(0, 120) + "..."
                : comments[0];
            contextSection += `- **${
              category.charAt(0).toUpperCase() + category.slice(1)
            }**: ${preview}\n`;
          }
        });
        contextSection += `\n`;
      }

      // Show most recent comments for general context
      contextSection += `**Recent Comments:** (${categorizedComments.recent.length} most recent):\n`;
      categorizedComments.recent.slice(0, 3).forEach((comment, index) => {
        const preview =
          comment.length > 150 ? comment.substring(0, 150) + "..." : comment;
        contextSection += `${index + 1}. ${preview}\n`;
      });

      if (prContext.existingComments.length > 5) {
        contextSection += `... and ${
          prContext.existingComments.length - 5
        } more previous comments\n`;
      }
    }
    contextSection += "\n";
  }

  // Add architectural context to prevent misunderstandings
  const architecturalContext = `

## Codebase Architecture Context
This is a TypeScript GitHub Action following specific architectural patterns:

**Type System Guidelines:**
- Domain types (shared across modules) belong in src/types.ts
- Service-specific types (internal parsing, API responses) stay in their service files
- Interface vs Type: Use 'type' for all definitions (@typescript-eslint/consistent-type-definitions rule)

**Architectural Patterns:**
- Functional core, imperative shell architecture
- Domain-driven design with clear separation of concerns
- Effects layer for side effects (API calls, file system)
- Services layer for orchestration
- Domains layer for pure business logic

**Before Suggesting Improvements:**
1. ✅ VERIFY if functionality already exists in the current code
2. ✅ CHECK if error handling, validation, optimizations are already implemented  
3. ✅ UNDERSTAND the difference between domain types (shared) vs implementation types (local)
4. ✅ CONSIDER if the code follows established patterns in this codebase
5. ✅ LOOK at the full context, not just the diff lines

**Common Patterns to Recognize:**
- Truncation logic for long content (already implemented in multiple places)
- Type definitions scoped appropriately (domain vs service-specific)
- Error handling patterns using custom error types
- Validation patterns using configuration
`;

  return `${fullPrompt}${contextSection}${architecturalContext}

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

## ⚠️  CRITICAL VERIFICATION REQUIREMENTS

**BEFORE suggesting ANY improvement, ASK YOURSELF:**
- "Is this functionality already implemented in the visible code?"
- "Does this suggestion contradict existing architectural patterns?"
- "Am I seeing the full context or just focusing on diff lines?"

## Required JSON Response Format Examples:

**1. File-level comment** (general feedback about entire file):
[
  {
    "file": "src/auth.ts",
    "comment": "**🟢 EXCELLENT: Comprehensive security implementation**\\n\\nThis authentication service demonstrates strong security practices with proper input validation, secure token handling, and comprehensive error boundaries. The use of bcrypt for password hashing and JWT for session management follows industry standards perfectly."
  }
]

**2. Single-line comment** (specific to one line):
[
  {
    "file": "src/database.ts",
    "line": 127,
    "comment": "**🔴 CRITICAL: SQL injection vulnerability**\\n\\nDirect string interpolation creates a serious security risk. Replace with parameterized query:\\n\\n\`const query = 'SELECT * FROM users WHERE email = $1';\`\\n\`const result = await db.query(query, [email]);\`\\n\\nThis prevents malicious SQL injection attacks that could compromise your entire database."
  }
]

**3. Multi-line comment** (spans multiple lines):
[
  {
    "file": "src/validation.ts",
    "start_line": 45,
    "line": 62,
    "comment": "**🟡 IMPORTANT: Consider extracting validation schema**\\n\\nThis validation logic is well-implemented but could benefit from better maintainability. Consider using a schema validation library like Joi or Yup:\\n\\n\`const schema = Joi.object({ name: Joi.string().required(), email: Joi.string().email() });\`\\n\\nThis approach provides better error messages, is more declarative, and easier to test and maintain as requirements evolve."
  }
]

Code changes:
${chunkContent}

Respond with ONLY a JSON array, no other text. Do not include explanations, thinking, or any text outside the JSON array. Start your response with [ and end with ].`;
};

// Helper function to validate comment structure
const isValidComment = (comment: unknown): comment is AICommentInput => {
  if (typeof comment !== "object" || comment === null) {
    return false;
  }
  const obj = comment as Record<string, unknown>;
  return (
    typeof obj.file === "string" &&
    (obj.line === undefined || typeof obj.line === "number") &&
    typeof obj.comment === "string"
  );
};

// Pure function to parse AI response into ReviewComments
export const parseAIResponse = (responseContent: string): ReviewComment[] => {
  let comments: ReviewComment[] = [];

  // First, clean up the response by removing common markdown formatting
  let cleanedResponse = responseContent.trim();

  // Remove markdown code blocks if present
  cleanedResponse = cleanedResponse.replace(/^```json\s*\n?/i, "");
  cleanedResponse = cleanedResponse.replace(/\n?```\s*$/i, "");
  cleanedResponse = cleanedResponse.replace(/^```\s*\n?/i, "");
  cleanedResponse = cleanedResponse.trim();

  try {
    // Try to parse the cleaned response first
    const parsedResponse = JSON.parse(cleanedResponse);
    comments = parsedResponse
      .filter((comment: unknown): comment is AICommentInput => {
        if (!isValidComment(comment)) {
          core.warning(
            `Invalid comment structure found, skipping: ${JSON.stringify(
              comment
            )}`
          );
          return false;
        }
        return true;
      })
      .map(
        (comment: {
          file: string;
          line?: number;
          start_line?: number;
          comment: string;
        }) => {
          const reviewComment: ReviewComment = {
            path: comment.file,
            body: comment.comment,
            commentType:
              comment.line !== undefined || comment.start_line !== undefined
                ? "diff"
                : "file",
          };

          if (comment.line !== undefined) {
            reviewComment.line = comment.line;
          }

          if (comment.start_line !== undefined) {
            reviewComment.start_line = comment.start_line;
          }

          return reviewComment;
        }
      );
  } catch (e) {
    // If that fails, try to extract JSON from the cleaned response
    try {
      // More robust JSON extraction - find the first [ and last ]
      const startIndex = cleanedResponse.indexOf("[");
      const lastIndex = cleanedResponse.lastIndexOf("]");

      if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
        const jsonString = cleanedResponse.substring(startIndex, lastIndex + 1);
        const parsedResponse = JSON.parse(jsonString);
        comments = parsedResponse
          .filter((comment: unknown): comment is AICommentInput => {
            if (!isValidComment(comment)) {
              core.warning(
                `Invalid comment structure found, skipping: ${JSON.stringify(
                  comment
                )}`
              );
              return false;
            }
            return true;
          })
          .map(
            (comment: {
              file: string;
              line?: number;
              start_line?: number;
              comment: string;
            }) => {
              const reviewComment: ReviewComment = {
                path: comment.file,
                body: comment.comment,
                commentType:
                  comment.line !== undefined || comment.start_line !== undefined
                    ? "diff"
                    : "file",
              };

              if (comment.line !== undefined) {
                reviewComment.line = comment.line;
              }

              if (comment.start_line !== undefined) {
                reviewComment.start_line = comment.start_line;
              }

              return reviewComment;
            }
          );
      } else {
        core.warning(
          "Failed to parse AI response as JSON - no JSON array found. The AI may have included text outside the JSON format."
        );
        core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
        core.info(
          "💡 Tip: Check if the AI model is following the JSON format instructions in the prompt."
        );
        comments = [];
      }
    } catch (e2) {
      // Final fallback: try to find individual JSON objects
      try {
        const jsonMatches = cleanedResponse.match(/\{[^{}]*"file"[^{}]*\}/g);
        if (jsonMatches && jsonMatches.length > 0) {
          const parsedComments = jsonMatches
            .map((match) => {
              try {
                return JSON.parse(match);
              } catch {
                return null;
              }
            })
            .filter(
              (comment): comment is AICommentInput =>
                comment && isValidComment(comment)
            )
            .map(
              (comment: {
                file: string;
                line?: number;
                start_line?: number;
                comment: string;
              }) => {
                const reviewComment: ReviewComment = {
                  path: comment.file,
                  body: comment.comment,
                  commentType:
                    comment.line !== undefined ||
                    comment.start_line !== undefined
                      ? "diff"
                      : "file",
                };

                if (comment.line !== undefined) {
                  reviewComment.line = comment.line;
                }

                if (comment.start_line !== undefined) {
                  reviewComment.start_line = comment.start_line;
                }

                return reviewComment;
              }
            );

          if (parsedComments.length > 0) {
            core.info(
              `💡 Successfully recovered ${parsedComments.length} comments using fallback parsing.`
            );
            comments = parsedComments;
          } else {
            core.warning(
              "Failed to parse AI response as JSON - the response may contain invalid JSON syntax."
            );
            core.warning(
              `Response was: ${responseContent.substring(0, 500)}...`
            );
            core.info(
              "💡 Tip: This could indicate the AI model isn't compatible with structured JSON responses. Consider using a different model."
            );
            comments = [];
          }
        } else {
          core.warning(
            "Failed to parse AI response as JSON - the response may contain invalid JSON syntax."
          );
          core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
          core.info(
            "💡 Tip: This could indicate the AI model isn't compatible with structured JSON responses. Consider using a different model."
          );
          comments = [];
        }
      } catch (e3) {
        core.warning(
          "Failed to parse AI response as JSON - the response may contain invalid JSON syntax."
        );
        core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
        core.info(
          "💡 Tip: This could indicate the AI model isn't compatible with structured JSON responses. Consider using a different model."
        );
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
  model: string,
  prContext?: PRContext
): Promise<{ comments: ReviewComment[]; tokens: TokenUsage }> => {
  // Always use repository context if available (simplified approach)
  const prompt = buildReviewPrompt(
    config,
    chunk.content,
    chunk.repositoryContext,
    prContext
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
