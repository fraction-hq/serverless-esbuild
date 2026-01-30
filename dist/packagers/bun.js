"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bun = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const utils_1 = require("../utils");
/**
 * Bun packager.
 */
class Bun {
    get lockfileName() {
        return 'bun.lock';
    }
    get copyPackageSectionNames() {
        return [];
    }
    get mustCopyModules() {
        return true;
    }
    async getProdDependencies(cwd, _depth) {
        const packageJsonPath = path.join(cwd, 'package.json');
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const dependencies = packageJson.dependencies || {};
            const result = { dependencies: {} };
            for (const [name, version] of Object.entries(dependencies)) {
                result.dependencies[name] = { version: version };
            }
            return result;
        }
        catch (err) {
            return { dependencies: {} };
        }
    }
    rebaseLockfile(_pathToPackageRoot, lockfile) {
        return lockfile;
    }
    async install(cwd, extraArgs, _useLockfile) {
        const command = 'bun';
        const args = ['install', '--production', ...extraArgs];
        try {
            await (0, utils_1.spawnProcess)(command, args, { cwd });
        }
        catch (err) {
            // Fallback without --production if it fails
            const fallbackArgs = ['install', ...extraArgs];
            await (0, utils_1.spawnProcess)(command, fallbackArgs, { cwd });
        }
    }
    async prune(_cwd) {
        // Bun doesn't have a prune command, no-op
    }
    async runScripts(cwd, scriptNames) {
        const command = 'bun';
        await Promise.all(scriptNames.map((scriptName) => {
            const args = ['run', scriptName];
            return (0, utils_1.spawnProcess)(command, args, { cwd });
        }));
    }
}
exports.Bun = Bun;
//# sourceMappingURL=bun.js.map