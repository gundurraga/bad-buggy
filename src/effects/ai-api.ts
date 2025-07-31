import { AIProviderResponse, AIProviderError } from "../types";

// Effect: Call Anthropic API
export const callAnthropic = async (
  prompt: string,
  apiKey: string,
  model: string
): Promise<AIProviderResponse> => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
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
};

// Effect: Call OpenRouter API
export const callOpenRouter = async (
  prompt: string,
  apiKey: string,
  model: string
): Promise<AIProviderResponse> => {
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
        max_tokens: 4000,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new AIProviderError(
      `OpenRouter API error: ${response.status} - ${errorText}`
    );
  }

  interface OpenRouterResponse {
    choices: Array<{
      message: {
        content: string;
      };
    }>;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
    };
  }

  const data = (await response.json()) as OpenRouterResponse;
  return {
    content: data.choices[0].message.content,
    usage: {
      input_tokens: data.usage.prompt_tokens,
      output_tokens: data.usage.completion_tokens,
    },
  };
};

// Effect: Route to appropriate AI provider
export const callAIProvider = async (
  provider: "anthropic" | "openrouter",
  prompt: string,
  apiKey: string,
  model: string
): Promise<AIProviderResponse> => {
  try {
    switch (provider) {
      case "anthropic":
        return await callAnthropic(prompt, apiKey, model);
      case "openrouter":
        return await callOpenRouter(prompt, apiKey, model);
      default:
        throw new AIProviderError(`Unsupported AI provider: ${provider}`);
    }
  } catch (error) {
    if (error instanceof AIProviderError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new AIProviderError(`AI provider call failed: ${errorMessage}`);
  }
};
