/**
 * Secure credential management service
 * Handles API key validation, access control, and secure storage
 */
export declare class CredentialManager {
    private static instance;
    private readonly credentials;
    private accessLog;
    private constructor();
    static getInstance(): CredentialManager;
    /**
     * Securely retrieve API key for a provider
     * @param provider The AI provider name
     * @returns The API key if valid and authorized
     */
    getApiKey(provider: string): string;
    /**
     * Securely store API key for a provider
     * @param provider The AI provider name
     * @param apiKey The API key to store
     */
    setApiKey(provider: string, apiKey: string): void;
    /**
     * Validate API key format based on provider
     * @param apiKey The API key to validate
     * @param provider The provider name
     * @returns True if valid format
     */
    private validateApiKey;
    /**
     * Get API key from environment variables
     * @param provider The provider name
     * @returns The API key from environment
     */
    private getFromEnvironment;
    /**
     * Log access attempts for security auditing
     * @param provider The provider name
     * @param action The action performed
     */
    private logAccess;
    /**
     * Clear all stored credentials (for security)
     */
    clearCredentials(): void;
    /**
     * Get access log for security auditing
     * @returns Array of access log entries
     */
    getAccessLog(): Array<{
        provider: string;
        timestamp: Date;
        action: string;
    }>;
    /**
     * Check if API key exists for provider
     * @param provider The provider name
     * @returns True if key exists
     */
    hasApiKey(provider: string): boolean;
    /**
     * Get expected secret name for provider
     * @param provider The provider name
     * @returns Expected GitHub secret name
     */
    private getExpectedSecretName;
    /**
     * Get provider URL for getting API keys
     * @param provider The provider name
     * @returns URL where users can get API keys
     */
    private getProviderUrl;
    /**
     * Get expected API key format for provider
     * @param provider The provider name
     * @returns Expected format description
     */
    private getExpectedFormat;
}
//# sourceMappingURL=credential-manager.d.ts.map