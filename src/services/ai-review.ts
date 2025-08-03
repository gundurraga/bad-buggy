import * as core from '@actions/core';
import { ReviewConfig, ReviewComment, TokenUsage, DiffChunk } from '../types';
import { callAIProvider } from '../effects/ai-api';
import { countTokens } from '../domains/review';
import { TokenCounterFactory } from './token-counter';

/**
 * Service for handling Bad Buggy-powered code review operations
 */

// Pure function to build review prompt
export const buildReviewPrompt = (config: ReviewConfig, chunkContent: string): string => {
  const basePrompt = config.review_prompt.replace(
    '{{DATE}}',
    new Date().toISOString().split('T')[0]
  );

  return `${basePrompt}

Please review the following code changes and provide feedback as a JSON array of comments.
Each comment should have:
- file: the filename
- line: the line number (from the diff)
- end_line: (optional) the end line for multi-line comments
- severity: "critical", "major", or "suggestion"
- category: one of ${config.review_aspects.join(', ')}
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
${chunkContent}

Respond with ONLY a JSON array, no other text. Do not include explanations, thinking, or any text outside the JSON array. Start your response with [ and end with ].`;
};

// Helper function to validate severity
const isValidSeverity = (severity: string): severity is ReviewComment['severity'] => {
  return ['critical', 'major', 'suggestion'].includes(severity);
};

// Pure function to parse AI response into ReviewComments
export const parseAIResponse = (responseContent: string): ReviewComment[] => {
  let comments: ReviewComment[] = [];
  
  try {
    // Try to parse the full response first
    const parsedResponse = JSON.parse(responseContent);
    comments = parsedResponse.map((comment: { file: string; line: number; end_line?: number; severity: string; comment: string }) => {
      if (!isValidSeverity(comment.severity)) {
        core.warning(`Invalid severity '${comment.severity}' found, defaulting to 'suggestion'`);
        comment.severity = 'suggestion';
      }
      return {
        path: comment.file,
        line: comment.line,
        end_line: comment.end_line,
        severity: comment.severity as ReviewComment['severity'],
        body: comment.comment
      };
    });
  } catch (e) {
    // If that fails, try to extract JSON from the response
    try {
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        comments = parsedResponse.map((comment: { file: string; line: number; end_line?: number; severity: string; comment: string }) => {
          if (!isValidSeverity(comment.severity)) {
            core.warning(`Invalid severity '${comment.severity}' found, defaulting to 'suggestion'`);
            comment.severity = 'suggestion';
          }
          return {
            path: comment.file,
            line: comment.line,
            end_line: comment.end_line,
            severity: comment.severity as ReviewComment['severity'],
            body: comment.comment
          };
        });
      } else {
        core.warning('Failed to parse AI response as JSON - no JSON array found');
        core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
        comments = [];
      }
    } catch (e2) {
      core.warning('Failed to parse AI response as JSON');
      core.warning(`Response was: ${responseContent.substring(0, 500)}...`);
      comments = [];
    }
  }
  
  return comments;
};

// Effect: Review a single chunk
export const reviewChunk = async (
  chunk: DiffChunk,
  config: ReviewConfig,
  provider: 'anthropic' | 'openrouter',
  apiKey: string,
  model: string
): Promise<{ comments: ReviewComment[]; tokens: TokenUsage }> => {
  const prompt = buildReviewPrompt(config, chunk.content);
  
  core.info(`🔗 Calling AI provider: ${provider} with model: ${model}`);
  core.info(`📝 Prompt length: ${prompt.length} characters`);

  // Pre-request token estimation using provider-specific token counter
  let estimatedInputTokens = 0;
  try {
    const tokenCounter = TokenCounterFactory.create(provider, apiKey);
    const tokenResult = await tokenCounter.countTokens(prompt, model);
    estimatedInputTokens = tokenResult.tokens;
    core.info(`🔢 Estimated input tokens: ${estimatedInputTokens}`);
  } catch (error) {
    core.warning(`Failed to get accurate token count, using fallback: ${error}`);
    estimatedInputTokens = countTokens(prompt, model);
  }

  const response = await callAIProvider(provider, prompt, apiKey, model);

  core.info(`🤖 AI Response received: ${response.content.length} characters`);
  core.info(
    `📊 AI Response preview: "${response.content.substring(0, 200)}${
      response.content.length > 200 ? '...' : ''
    }"`
  );

  // Log enhanced usage information if available
  if (response.usage) {
    core.info(`📊 Token usage - Input: ${response.usage.input_tokens}, Output: ${response.usage.output_tokens}`);
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