export class AIProviderError extends Error {
  public readonly provider: string;
  public readonly status?: number;

  constructor(message: string, provider: string, status?: number) {
    super(message);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.status = status;
  }
}

interface AnthropicResponse {
  content: Array<{ text: string }>;
}

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: {
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
}

async function callAnthropic(prompt: string, model: string, apiKey: string): Promise<string> {
  if (!apiKey) {
    throw new AIProviderError('Anthropic API key is required', 'anthropic');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new AIProviderError(
      `Anthropic API error: ${response.statusText}`,
      'anthropic',
      response.status
    );
  }

  const data: AnthropicResponse = await response.json();
  return data.content[0].text;
}

async function callOpenRouter(prompt: string, model: string, apiKey: string): Promise<string> {
  if (!apiKey) {
    throw new AIProviderError('OpenRouter API key is required', 'openrouter');
  }

  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/gundurraga/bad-buggy',
        'X-Title': 'bad-buggy',
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        usage: {
          include: true, // Enable OpenRouter usage accounting
        },
      }),
    }
  );

  if (!response.ok) {
    throw new AIProviderError(
      `OpenRouter API error: ${response.statusText}`,
      'openrouter',
      response.status
    );
  }

  const data: OpenRouterResponse = await response.json();
  return data.choices[0].message.content;
}

export async function callAIProvider(
  provider: string,
  prompt: string,
  model: string,
  apiKey: string
): Promise<string> {
  try {
    switch (provider) {
      case 'anthropic':
        return await callAnthropic(prompt, model, apiKey);
      case 'openrouter':
        return await callOpenRouter(prompt, model, apiKey);
      default:
        throw new AIProviderError(`Unknown provider: ${provider}`, provider);
    }
  } catch (error) {
    if (error instanceof AIProviderError) {
      throw error;
    }
    throw new AIProviderError(
      `Provider call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      provider
    );
  }
}