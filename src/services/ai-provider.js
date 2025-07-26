const core = require("@actions/core");

class AIProvider {
  constructor(provider, apiKey) {
    this.provider = provider;
    this.apiKey = apiKey;
  }

  async reviewChunk(chunk, config) {
    const prompt = this._buildPrompt(chunk, config);

    let response;
    let inputTokens = Math.ceil(prompt.length / 4); // rough estimate
    let outputTokens = 0;

    if (this.provider === "anthropic") {
      response = await this._callAnthropic(prompt, config.model);
    } else if (this.provider === "openrouter") {
      response = await this._callOpenRouter(prompt, config.model);
    } else {
      throw new Error(`Unknown provider: ${this.provider}`);
    }

    outputTokens = Math.ceil(response.length / 4); // rough estimate

    // Parse response
    const comments = this._parseResponse(response);

    return { comments, inputTokens, outputTokens };
  }

  _buildPrompt(chunk, config) {
    return `${config.review_prompt}

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
  }

  async _callAnthropic(prompt, model) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
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

  async _callOpenRouter(prompt, model) {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
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

  _parseResponse(response) {
    try {
      // Try to parse the full response first
      return JSON.parse(response);
    } catch (e) {
      // If that fails, try to extract JSON from the response
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        } else {
          core.warning(
            "Failed to parse AI response as JSON - no JSON array found"
          );
          return [];
        }
      } catch (e2) {
        core.warning("Failed to parse AI response as JSON");
        core.warning(`Response was: ${response.substring(0, 500)}...`);
        return [];
      }
    }
  }
}

module.exports = { AIProvider };
