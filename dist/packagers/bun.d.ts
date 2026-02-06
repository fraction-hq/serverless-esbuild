import type { DependenciesResult, JSONObject } from "../types";
import type { Packager } from "./packager";
/**
 * Bun packager.
 */
export declare class Bun implements Packager {
    get lockfileName(): string;
    get copyPackageSectionNames(): never[];
    get mustCopyModules(): boolean;
    getProdDependencies(cwd: string, _depth?: number): Promise<DependenciesResult>;
    rebaseLockfile(_pathToPackageRoot: string, lockfile: JSONObject): any;
    install(cwd: string, extraArgs: string[], _useLockfile: boolean): Promise<void>;
    prune(_cwd: string): Promise<void>;
    runScripts(cwd: string, scriptNames: string[]): Promise<void>;
}
//# sourceMappingURL=bun.d.ts.map