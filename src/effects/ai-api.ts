import { AIProviderResponse, AIProviderError } from "../types";
import { CredentialManager } from "../security/credential-manager";
import { REVIEW_CONSTANTS, ERROR_MESSAGES } from "../constants";

// Helper function to determine if an error should be retried
const shouldRetry = (error: unknown): boolean => {
  if (error instanceof AIProviderError && error.statusCode) {
    // Retry on server errors (5xx) and rate limits (429)
    return error.statusCode >= 500 || error.statusCode === 429;
  }
  // Retry on network errors
  return (
    error instanceof Error &&
    (error.message.includes("network") ||
      error.message.includes("timeout") ||
      error.message.includes("ECONNRESET"))
  );
};

// Generic retry wrapper for API calls
export const callWithRetry = async <T>(
  apiCall: () => Promise<T>,
  retries = REVIEW_CONSTANTS.MAX_RETRIES
): Promise<T> => {
  try {
    return await apiCall();
  } catch (error) {
    if (retries > 0 && shouldRetry(error)) {
      await new Promise((resolve) =>
        setTimeout(resolve, REVIEW_CONSTANTS.RETRY_DELAY_MS)
      );
      return callWithRetry(apiCall, retries - 1);
    }
    throw error;
  }
};

// Effect: Call Anthropic API
export const callAnthropic = async (
  prompt: string,
  model: string
): Promise<AIProviderResponse> => {
  return callWithRetry(async () => {
    const credentialManager = CredentialManager.getInstance();
    const apiKey = credentialManager.getApiKey("anthropic");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: REVIEW_CONSTANTS.MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AIProviderError(
        `Anthropic API error: ${errorText}`,
        response.status
      );
    }

    const data = await response.json();
    return {
      content: data.content[0].text,
      usage: {
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
      },
    };
  });
};

// Effect: Call OpenRouter API
export const callOpenRouter = async (
  prompt: string,
  model: string
): Promise<AIProviderResponse> => {
  return callWithRetry(async () => {
    const credentialManager = CredentialManager.getInstance();
    const apiKey = credentialManager.getApiKey("openrouter");
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://github.com/gundurraga/bad-buggy",
          "X-Title": "Bad Buggy Code Reviewer",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: REVIEW_CONSTANTS.MAX_TOKENS,
          usage: {
            include: true, // Enable OpenRouter usage accounting
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new AIProviderError(
        `OpenRouter API error: ${response.status} - ${errorText}`
      );
    }

    type OpenRouterResponse = {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        cost?: number;
        cost_details?: {
          upstream_inference_cost?: number;
        };
        prompt_tokens_details?: {
          cached_tokens?: number;
        };
        completion_tokens_details?: {
          reasoning_tokens?: number;
        };
      };
    };

    const data = (await response.json()) as OpenRouterResponse;
    return {
      content: data.choices[0].message.content,
      usage: {
        input_tokens: data.usage.prompt_tokens,
        output_tokens: data.usage.completion_tokens,
        cost: data.usage.cost,
        cost_details: data.usage.cost_details,
        cached_tokens: data.usage.prompt_tokens_details?.cached_tokens,
        reasoning_tokens:
          data.usage.completion_tokens_details?.reasoning_tokens,
      },
    };
  });
};

// Effect: Route to appropriate AI provider
export const callAIProvider = async (
  provider: "anthropic" | "openrouter",
  prompt: string,
  model: string
): Promise<AIProviderResponse> => {
  try {
    switch (provider) {
      case "anthropic":
        return await callAnthropic(prompt, model);
      case "openrouter":
        return await callOpenRouter(prompt, model);
      default:
        throw new AIProviderError(
          `${ERROR_MESSAGES.UNSUPPORTED_PROVIDER}: ${provider}`
        );
    }
  } catch (error) {
    if (error instanceof AIProviderError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new AIProviderError(`AI provider call failed: ${errorMessage}`);
  }
};
