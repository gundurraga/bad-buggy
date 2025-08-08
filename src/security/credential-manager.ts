import * as core from "@actions/core";
import {
  REVIEW_CONSTANTS,
  ERROR_MESSAGES,
  PROVIDER_FORMATS,
  PROVIDER_URLS,
} from "../constants";

/**
 * Secure credential management service
 * Handles API key validation, access control, and secure storage
 */
export class CredentialManager {
  private static instance: CredentialManager;
  private readonly credentials: Map<string, string> = new Map();
  private accessLog: Array<{
    provider: string;
    timestamp: Date;
    action: string;
  }> = [];

  private constructor() {}

  public static getInstance(): CredentialManager {
    if (!CredentialManager.instance) {
      CredentialManager.instance = new CredentialManager();
    }
    return CredentialManager.instance;
  }

  /**
   * Securely retrieve API key for a provider
   * @param provider The AI provider name
   * @returns The API key if valid and authorized
   */
  public getApiKey(provider: string): string {
    this.logAccess(provider, "retrieve");

    const key =
      this.credentials.get(provider) || this.getFromEnvironment(provider);

    if (!key) {
      throw new Error(
        `❌ ${ERROR_MESSAGES.NO_API_KEY}: ${provider}\n\n` +
          `🔧 Fix: Add your API key as a repository secret:\n` +
          `1. Go to Settings → Secrets and variables → Actions\n` +
          `2. Add: ${this.getExpectedSecretName(provider)}\n` +
          `3. Get your key from: ${this.getProviderUrl(provider)}\n\n` +
          `💡 Make sure the secret name matches exactly (case-sensitive)`
      );
    }

    if (!this.validateApiKey(key, provider)) {
      throw new Error(
        `❌ ${ERROR_MESSAGES.INVALID_API_KEY_FORMAT}: ${provider}\n\n` +
          `Expected format: ${this.getExpectedFormat(provider)}\n` +
          `Received format: ${key.substring(0, 10)}...\n\n` +
          `🔧 Fix: Get a valid API key from: ${this.getProviderUrl(provider)}`
      );
    }

    return key;
  }

  /**
   * Securely store API key for a provider
   * @param provider The AI provider name
   * @param apiKey The API key to store
   */
  public setApiKey(provider: string, apiKey: string): void {
    if (!this.validateApiKey(apiKey, provider)) {
      throw new Error(
        `❌ ${ERROR_MESSAGES.INVALID_API_KEY_FORMAT}: ${provider}\n\n` +
          `Expected format: ${this.getExpectedFormat(provider)}\n` +
          `🔧 Fix: Get a valid API key from: ${this.getProviderUrl(provider)}`
      );
    }

    this.credentials.set(provider, apiKey);
    this.logAccess(provider, "store");
  }

  /**
   * Validate API key format based on provider
   * @param apiKey The API key to validate
   * @param provider The provider name
   * @returns True if valid format
   */
  private validateApiKey(apiKey: string, provider: string): boolean {
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
      return false;
    }

    // Provider-specific validation
    switch (provider.toLowerCase()) {
      case "anthropic":
        return (
          apiKey.startsWith("sk-ant-") &&
          apiKey.length > REVIEW_CONSTANTS.MIN_API_KEY_LENGTH
        );
      case "openrouter":
        return (
          apiKey.startsWith("sk-or-") &&
          apiKey.length > REVIEW_CONSTANTS.MIN_API_KEY_LENGTH
        );
      default:
        // Generic validation for unknown providers
        return apiKey.length > 10;
    }
  }

  /**
   * Get API key from environment variables
   * @param provider The provider name
   * @returns The API key from environment
   */
  private getFromEnvironment(provider: string): string | undefined {
    const envVarNames = {
      anthropic: ["ANTHROPIC_API_KEY"],
      openrouter: ["OPENROUTER_API_KEY"],
    };

    const possibleNames = envVarNames[
      provider.toLowerCase() as keyof typeof envVarNames
    ] || [`${provider.toUpperCase()}_API_KEY`];

    for (const envVar of possibleNames) {
      const value =
        process.env[envVar] ||
        core.getInput(envVar.toLowerCase().replace("_", "-"));
      if (value) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * Log access attempts for security auditing
   * @param provider The provider name
   * @param action The action performed
   */
  private logAccess(provider: string, action: string): void {
    this.accessLog.push({
      provider,
      timestamp: new Date(),
      action,
    });

    // Keep only last entries to prevent memory leaks
    if (this.accessLog.length > REVIEW_CONSTANTS.MAX_ACCESS_LOG_ENTRIES) {
      this.accessLog = this.accessLog.slice(
        -REVIEW_CONSTANTS.MAX_ACCESS_LOG_ENTRIES
      );
    }

    core.debug(`Credential access: ${provider} - ${action}`);
  }

  /**
   * Clear all stored credentials (for security)
   */
  public clearCredentials(): void {
    this.credentials.clear();
    this.logAccess("system", "clear_all");
  }

  /**
   * Get access log for security auditing
   * @returns Array of access log entries
   */
  public getAccessLog(): Array<{
    provider: string;
    timestamp: Date;
    action: string;
  }> {
    return [...this.accessLog]; // Return copy to prevent modification
  }

  /**
   * Check if API key exists for provider
   * @param provider The provider name
   * @returns True if key exists
   */
  public hasApiKey(provider: string): boolean {
    return (
      this.credentials.has(provider) || !!this.getFromEnvironment(provider)
    );
  }

  /**
   * Get expected secret name for provider
   * @param provider The provider name
   * @returns Expected GitHub secret name
   */
  private getExpectedSecretName(provider: string): string {
    const secretNames = {
      anthropic: "ANTHROPIC_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
    };
    return (
      secretNames[provider.toLowerCase() as keyof typeof secretNames] ||
      `${provider.toUpperCase()}_API_KEY`
    );
  }

  /**
   * Get provider URL for getting API keys
   * @param provider The provider name
   * @returns URL where users can get API keys
   */
  private getProviderUrl(provider: string): string {
    return (
      PROVIDER_URLS[provider.toLowerCase() as keyof typeof PROVIDER_URLS] ||
      `https://${provider.toLowerCase()}.com`
    );
  }

  /**
   * Get expected API key format for provider
   * @param provider The provider name
   * @returns Expected format description
   */
  private getExpectedFormat(provider: string): string {
    return (
      PROVIDER_FORMATS[
        provider.toLowerCase() as keyof typeof PROVIDER_FORMATS
      ] || "Valid API key format"
    );
  }
}
