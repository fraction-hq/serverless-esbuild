import type { FileSystem } from '@effect/platform';
import { NodeFileSystem } from '@effect/platform-node';
import archiver from 'archiver';
import { bestzip } from 'bestzip';
import { type Cause, Effect, Option } from 'effect';
import execa from 'execa';
import fs from 'fs-extra';
import path from 'path';
import type { ESMPluginsModule, IFile, IFiles } from './types';
import { FSyncLayer, makePath, makeTempPathScoped, safeFileExists } from './utils/effect-fs';

export class SpawnError extends Error {
  constructor(message: string, public stdout: string, public stderr: string) {
    super(message);
  }

  toString() {
    return `${this.message}\n${this.stderr}`;
  }
}

/**
 * Executes a child process without limitations on stdout and stderr.
 * On error (exit code is not 0), it rejects with a SpawnProcessError that contains the stdout and stderr streams,
 * on success it returns the streams in an object.
 * @param {string} command - Command
 * @param {string[]} [args] - Arguments
 * @param {Object} [options] - Options for child_process.spawn
 */
export function spawnProcess(command: string, args: string[], options: execa.Options) {
  return execa(command, args, options);
}

const rootOf = (p: string) => path.parse(path.resolve(p)).root;
const isPathRoot = (p: string) => rootOf(p) === path.resolve(p);
const findUpEffect = (
  names: string[],
  directory = process.cwd()
): Effect.Effect<string, Cause.NoSuchElementException, FileSystem.FileSystem> => {
  const dir = path.resolve(directory);
  return Effect.all(names.map((name) => safeFileExists(path.join(dir, name)))).pipe(
    Effect.flatMap((exist) => {
      if (exist.some(Boolean)) return Option.some(dir);
      if (isPathRoot(dir)) return Option.none();
      return findUpEffect(names, path.dirname(dir));
    })
  );
};

/**
 * Find a file by walking up parent directories
 */
export const findUp = (name: string) =>
  findUpEffect([name]).pipe(
    Effect.orElseSucceed(() => undefined),
    Effect.provide(FSyncLayer),
    Effect.runSync
  );

/**
 * Forwards `rootDir` or finds project root folder.
 */
export const findProjectRoot = (rootDir?: string) =>
  Effect.fromNullable(rootDir).pipe(
    Effect.orElse(() => findUpEffect(['yarn.lock', 'pnpm-lock.yaml', 'package-lock.json', 'bun.lock', 'bun.lockb'])),
    Effect.orElseSucceed(() => undefined),
    Effect.provide(FSyncLayer),
    Effect.runSync
  );

export const humanSize = (size: number) => {
  const exponent = Math.floor(Math.log(size) / Math.log(1024));
  const sanitized = (size / 1024 ** exponent).toFixed(2);

  return `${sanitized} ${['B', 'KB', 'MB', 'GB', 'TB'][exponent]}`;
};

export const zip = async (
  zipPath: string,
  filesPathList: IFiles,
  useNativeZip?: boolean,
  statCache?: Map<string, fs.Stats>
): Promise<void> => {
  if (useNativeZip === true) {
    // bestzip requires files on disk in a flat directory structure
    const tempDirName = `${path.basename(zipPath, path.extname(zipPath))}-${Date.now().toString()}`;

    const linkOrCopyFile = (temp: string) => (file: IFile) => {
      const dest = path.join(temp, file.localPath);
      return makePath(path.dirname(dest)).pipe(
        Effect.andThen(
          Effect.tryPromise(async () => {
            try {
              await fs.link(file.rootPath, dest);
            } catch {
              await fs.copy(file.rootPath, dest);
            }
          })
        )
      );
    };

    const bestZipEffect = (temp: string) =>
      Effect.tryPromise(() => bestzip({ source: '*', destination: zipPath, cwd: temp }));

    const archiveEffect = makeTempPathScoped(tempDirName).pipe(
      Effect.tap((temp) => Effect.all(filesPathList.map(linkOrCopyFile(temp)), { discard: true })),
      Effect.tap(() => makePath(path.dirname(zipPath))),
      Effect.andThen((temp) => bestZipEffect(temp)),
      Effect.scoped
    );

    await archiveEffect.pipe(Effect.provide(NodeFileSystem.layer), Effect.runPromise);
  } else {
    // Skip temp directory entirely - nodeZip reads directly from rootPath
    await makePath(path.dirname(zipPath)).pipe(Effect.provide(NodeFileSystem.layer), Effect.runPromise);
    await nodeZip(zipPath, filesPathList, statCache);
  }
};

function nodeZip(zipPath: string, filesPathList: IFiles, statCache?: Map<string, fs.Stats>): Promise<void> {
  return new Promise((resolve, reject) => {
    const zipArchive = archiver.create('zip');
    const output = fs.createWriteStream(zipPath);

    output.on('close', resolve);
    zipArchive.on('error', (err) => reject(err));

    // write zip
    output.on('open', () => {
      try {
        zipArchive.pipe(output);

        filesPathList.forEach((file) => {
          const stats = statCache?.get(file.rootPath) ?? fs.statSync(file.rootPath);
          if (stats.isDirectory()) return;

          zipArchive.file(file.rootPath, {
            name: file.localPath,
            mode: stats.mode,
            date: new Date(0), // necessary to get the same hash when zipping the same content
          });
        });

        zipArchive.finalize();
      } catch (err) {
        reject(err);
      }
    });
  });
}

export function trimExtension(entry: string) {
  return entry.slice(0, -path.extname(entry).length);
}

export const isEmpty = (obj: Record<string, unknown>) => {
  // eslint-disable-next-line no-unreachable-loop
  for (const _i in obj) return false;

  return true;
};

export const isESMModule = (obj: unknown): obj is ESMPluginsModule => {
  return typeof obj === 'object' && obj !== null && 'default' in obj;
};
