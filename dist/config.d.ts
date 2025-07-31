import { ReviewConfig } from './types';
export declare const DEFAULT_CONFIG: ReviewConfig;
export declare const mergeConfig: (defaultConfig: ReviewConfig, userConfig: Partial<ReviewConfig>) => ReviewConfig;
export declare const loadConfig: (configFile: string) => Promise<ReviewConfig>;
//# sourceMappingURL=config.d.ts.map