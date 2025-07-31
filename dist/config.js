"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = exports.mergeConfig = exports.DEFAULT_CONFIG = void 0;
const file_system_1 = require("./effects/file-system");
const default_config_1 = require("./config/default-config");
Object.defineProperty(exports, "DEFAULT_CONFIG", { enumerable: true, get: function () { return default_config_1.DEFAULT_CONFIG; } });
// Pure function to merge configurations
const mergeConfig = (defaultConfig, userConfig) => {
    return {
        ...defaultConfig,
        ...userConfig
    };
};
exports.mergeConfig = mergeConfig;
// Effect: Load and merge configuration
const loadConfig = async (configFile) => {
    const userConfig = await (0, file_system_1.loadConfigFromFile)(configFile);
    return userConfig ? (0, exports.mergeConfig)(default_config_1.DEFAULT_CONFIG, userConfig) : default_config_1.DEFAULT_CONFIG;
};
exports.loadConfig = loadConfig;
//# sourceMappingURL=config.js.map