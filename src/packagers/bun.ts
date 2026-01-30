import * as fs from 'fs';
import * as path from 'path';

import type { DependenciesResult, JSONObject } from '../types';
import { spawnProcess } from '../utils';
import type { Packager } from './packager';

/**
 * Bun packager.
 */
export class Bun implements Packager {
  get lockfileName() {
    return 'bun.lock';
  }

  get copyPackageSectionNames() {
    return [];
  }

  get mustCopyModules() {
    return true;
  }

  async getProdDependencies(cwd: string, _depth?: number): Promise<DependenciesResult> {
    const packageJsonPath = path.join(cwd, 'package.json');
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const dependencies = packageJson.dependencies || {};
      const result: DependenciesResult = { dependencies: {} };
      for (const [name, version] of Object.entries(dependencies)) {
        result.dependencies![name] = { version: version as string };
      }
      return result;
    } catch (err) {
      return { dependencies: {} };
    }
  }

  rebaseLockfile(_pathToPackageRoot: string, lockfile: JSONObject) {
    return lockfile;
  }

  async install(cwd: string, extraArgs: string[], _useLockfile: boolean) {
    const command = 'bun';
    const args = ['install', '--production', ...extraArgs];
    try {
      await spawnProcess(command, args, { cwd });
    } catch (err) {
      // Fallback without --production if it fails
      const fallbackArgs = ['install', ...extraArgs];
      await spawnProcess(command, fallbackArgs, { cwd });
    }
  }

  async prune(_cwd: string) {
    // Bun doesn't have a prune command, no-op
  }

  async runScripts(cwd: string, scriptNames: string[]) {
    const command = 'bun';
    await Promise.all(
      scriptNames.map((scriptName) => {
        const args = ['run', scriptName];
        return spawnProcess(command, args, { cwd });
      })
    );
  }
}
