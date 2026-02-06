import assert from 'assert';
import { Predicate } from 'effect';
import type { BuildOptions } from 'esbuild';
import * as pkg from 'esbuild';
import fs from 'fs-extra';
import path from 'path';
import { uniq } from 'ramda';

import type EsbuildServerlessPlugin from './index';
import { asArray, assertIsString, isESM } from './helper';
import type { EsbuildOptions, FileBuildResult, FunctionBuildResult } from './types';

const getStringArray = (input: unknown): string[] => asArray(input).filter(Predicate.isString);

/**
 * Extract package names from the extended external format.
 * Handles both simple strings and objects like { packageName: { postinstall: "..." } }
 */
const getExternalNames = (externals: unknown): string[] => {
  const arr = asArray(externals);
  const names: string[] = [];

  for (const item of arr) {
    if (typeof item === 'string') {
      names.push(item);
    } else if (typeof item === 'object' && item !== null) {
      // Object format: { packageName: { postinstall: "..." } }
      names.push(...Object.keys(item));
    }
  }

  return names;
};

export async function bundle(this: EsbuildServerlessPlugin): Promise<void> {
  assert(this.buildOptions, 'buildOptions is not defined');

  this.prepare();

  this.log.verbose(`Compiling to ${this.buildOptions?.target} bundle with esbuild...`);

  const exclude = getStringArray(this.buildOptions?.exclude);

  // esbuild v0.7.0 introduced config options validation, so I have to delete plugin specific options from esbuild config.
  const esbuildOptions: EsbuildOptions = [
    'concurrency',
    'zipConcurrency',
    'exclude',
    'nativeZip',
    'packager',
    'packagePath',
    'watch',
    'keepOutputDirectory',
    'packagerOptions',
    'installExtraArgs',
    'installDeps',
    'outputFileExtension',
    'outputBuildFolder',
    'outputWorkFolder',
    'nodeExternals',
    'skipBuild',
    'skipRebuild',
    'skipBuildExcludeFns',
    'stripEntryResolveExtensions',
    'disposeContext',
  ].reduce<Record<string, any>>((options, optionName) => {
    const { [optionName]: _, ...rest } = options;

    return rest;
  }, this.buildOptions);

  const config: Omit<BuildOptions, 'watch'> = {
    ...esbuildOptions,
    external: [...getExternalNames(this.buildOptions?.external), ...(exclude.includes('*') ? [] : exclude)],
    plugins: this.plugins,
  };

  const { buildOptions, buildDirPath } = this;

  assert(buildOptions, 'buildOptions is not defined');

  assertIsString(buildDirPath, 'buildDirPath is not a string');

  if (isESM(buildOptions) && buildOptions.outputFileExtension === '.cjs') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Serverless typings (as of v3.0.2) are incorrect
    throw new this.serverless.classes.Error(
      'ERROR: format "esm" or platform "neutral" should not output a file with extension ".cjs".'
    );
  }

  if (!isESM(buildOptions) && buildOptions.outputFileExtension === '.mjs') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Serverless typings (as of v3.0.2) are incorrect
    throw new this.serverless.classes.Error('ERROR: Non esm builds should not output a file with extension ".mjs".');
  }

  if (buildOptions.outputFileExtension !== '.js') {
    config.outExtension = { '.js': buildOptions.outputFileExtension };
  }

  // Files can contain multiple handlers for multiple functions, we want to get only the unique ones
  const uniqueFiles: string[] = uniq(this.functionEntries.map(({ entry }) => entry));

  this.log.verbose(`Compiling ${uniqueFiles.length} entrypoints in a single esbuild build...`);

  /** Build all entrypoints in a single esbuild call for shared module graph */
  const buildResult = await pkg.build({
    ...config,
    entryPoints: uniqueFiles,
    outdir: buildDirPath,
    outbase: '.',
  });

  if (config.metafile) {
    fs.writeFileSync(path.join(buildDirPath, 'meta.json'), JSON.stringify(buildResult.metafile, null, 2));
  }

  const fileBuildResults: FileBuildResult[] = uniqueFiles.map((entry) => {
    const bundlePath = entry.slice(0, entry.lastIndexOf('.')) + buildOptions.outputFileExtension;
    return { bundlePath, entry, result: buildResult };
  });

  // Create a local cache with entry as key (not instance-level to avoid memory leak)
  const buildCache = fileBuildResults.reduce<Record<string, FileBuildResult>>((acc, fileBuildResult) => {
    acc[fileBuildResult.entry] = fileBuildResult;

    return acc;
  }, {});

  // Map function entries back to bundles
  this.buildResults = this.functionEntries
    .map(({ entry, func, functionAlias }) => {
      const { bundlePath } = buildCache[entry] ?? {};

      if (typeof bundlePath !== 'string' || func === null) {
        return;
      }

      return { bundlePath, func, functionAlias };
    })
    .filter((result): result is FunctionBuildResult => typeof result === 'object');

  this.log.verbose('Compiling completed.');
}
