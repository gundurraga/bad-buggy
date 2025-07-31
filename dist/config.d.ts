import { ReviewConfig } from './types';
import { DEFAULT_CONFIG } from './config/default-config';
export { DEFAULT_CONFIG };
export declare const mergeConfig: (defaultConfig: ReviewConfig, userConfig: Partial<ReviewConfig>) => ReviewConfig;
export declare const loadConfig: (configFile: string) => Promise<ReviewConfig>;
//# sourceMappingURL=config.d.ts.map