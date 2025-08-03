import { ReviewComment, TokenUsage } from '../types';
/**
 * Centralized logging service for consistent and organized output
 */
export declare class Logger {
    static startup(): void;
    static inputs(provider: string, model: string, configFile: string): void;
    static inputValidation(): void;
    static configLoading(configFile: string): void;
    static configLoaded(maxComments: number): void;
    static configValidation(): void;
    static githubInit(owner: string, repo: string, eventName: string): void;
    static prInfo(number: number, title: string, author: string, body: string | null, url: string, headRef: string, baseRef: string, additions: number, deletions: number, changedFiles: number): void;
    static securityCheck(): void;
    static modifiedFiles(files: string[]): void;
    static securityPassed(): void;
    static userPermissionCheck(username: string): void;
    static userPermissionLevel(level: string): void;
    static userPermissionsPassed(): void;
    static diffProcessing(): void;
    static chunksCreated(count: number): void;
    static noFilesToReview(): void;
    static reviewStart(): void;
    static chunkReview(current: number, total: number, contentLength: number, files: string[] | undefined): void;
    static aiProviderCall(current: number, provider: string, model: string): void;
    static chunkResults(current: number, commentCount: number, inputTokens: number, outputTokens: number, duration: number): void;
    static chunkIssues(current: number, comments: ReviewComment[]): void;
    static totalResults(commentCount: number, inputTokens: number, outputTokens: number): void;
    static commentProcessing(): void;
    static severityBreakdown(severityCounts: Record<string, number>): void;
    static finalComments(finalCount: number, originalCount: number): void;
    static filteringReasons(maxComments: number): void;
    static postingReview(summaryLength: number, commentCount: number): void;
    static reviewPosted(commentCount: number, duration: number): void;
    static summaryOnly(summaryLength: number): void;
    static summaryPosted(duration: number): void;
    static costCalculation(): void;
    static costSummary(totalCost: number, inputCost: number, outputCost: number): void;
    static costBreakdown(tokens: TokenUsage, inputCost: number, outputCost: number, totalCost: number): void;
    static completion(): void;
    static commentFiltering(filteredCount: number, filteredComments: string[]): void;
    static error(message: string): void;
}
//# sourceMappingURL=logger.d.ts.map