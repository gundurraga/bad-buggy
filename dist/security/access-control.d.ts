import { Context } from '@actions/github/lib/context';
import { getOctokit } from '@actions/github';
import { Config } from '../types';
type Octokit = ReturnType<typeof getOctokit>;
interface PullRequest {
    user: {
        login: string;
    };
    head: {
        repo: {
            full_name: string;
        };
    };
    base: {
        repo: {
            full_name: string;
        };
    };
    number: number;
}
interface SecurityCheckResult {
    allowed: boolean;
    reason: string;
    message: string | null;
}
export declare function performSecurityCheck(octokit: Octokit, context: Context, pr: PullRequest, config: Config): Promise<SecurityCheckResult>;
export {};
//# sourceMappingURL=access-control.d.ts.map