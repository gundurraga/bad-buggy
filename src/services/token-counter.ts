import { AIProviderError } from '../types';

// Token counting interfaces
export interface TokenCountResult {
  tokens: number;
  provider: string;
  model: string;
}

export interface TokenCounter {
  countTokens(text: string, model: string): Promise<TokenCountResult>;
}

// Anthropic Token Counter using their Token Counting API
export class AnthropicTokenCounter implements TokenCounter {
  constructor(private apiKey: string) {}

  async countTokens(text: string, model: string): Promise<TokenCountResult> {
    if (!this.apiKey) {
      throw new AIProviderError('Anthropic API key is required for token counting');
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: text }],
        }),
      });

      if (!response.ok) {
        throw new AIProviderError(
          `Anthropic token counting API error: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      return {
        tokens: data.input_tokens,
        provider: 'anthropic',
        model: model,
      };
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError(
        `Failed to count tokens with Anthropic: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// OpenRouter Token Counter using minimal completion requests
export class OpenRouterTokenCounter implements TokenCounter {
  constructor(private apiKey: string) {}

  async countTokens(text: string, model: string): Promise<TokenCountResult> {
    if (!this.apiKey) {
      throw new AIProviderError('OpenRouter API key is required for token counting');
    }

    try {
      // Use a minimal completion request to get token count
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/gundurraga/bad-buggy',
          'X-Title': 'Bad Buggy Code Reviewer',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: text }],
          max_tokens: 1, // Minimal completion to get token count
          usage: {
            include: true, // Enable usage accounting
          },
        }),
      });

      if (!response.ok) {
        throw new AIProviderError(
          `OpenRouter token counting API error: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      return {
        tokens: data.usage?.prompt_tokens || 0,
        provider: 'openrouter',
        model: model,
      };
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError(
        `Failed to count tokens with OpenRouter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Token Counter Factory
export class TokenCounterFactory {
  static create(provider: 'anthropic' | 'openrouter', apiKey: string): TokenCounter {
    switch (provider) {
      case 'anthropic':
        return new AnthropicTokenCounter(apiKey);
      case 'openrouter':
        return new OpenRouterTokenCounter(apiKey);
      default:
        throw new AIProviderError(`Unsupported provider for token counting: ${provider}`);
    }
  }
}