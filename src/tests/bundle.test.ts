import { build } from 'esbuild';
import type { PartialDeep } from 'type-fest';

import { bundle } from '../bundle';

import type { Configuration, FunctionBuildResult, FunctionEntry } from '../types';
import type EsbuildServerlessPlugin from '../index';

jest.mock('esbuild');

const getBuild = async () => {
  return build;
};

const esbuildPlugin = (override?: Partial<EsbuildServerlessPlugin>): EsbuildServerlessPlugin =>
  ({
    prepare: jest.fn(),
    serverless: {
      cli: {
        log: jest.fn(),
      },
      classes: {
        Error,
      },
    },
    buildOptions: {
      concurrency: Infinity,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},
      platform: 'node',
      outputFileExtension: '.js',
    },
    plugins: [],
    buildDirPath: '/workdir/.esbuild',
    functionEntries: [],
    log: {
      error: jest.fn(),
      warning: jest.fn(),
      notice: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      success: jest.fn(),
    },
    ...override,
  } as PartialDeep<EsbuildServerlessPlugin> as EsbuildServerlessPlugin);

afterEach(() => {
  jest.resetAllMocks();
});

it('should call esbuild only once when functions share the same entry', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler2',
      },
      functionAlias: 'func2',
    },
  ];

  await bundle.call(esbuildPlugin({ functionEntries }));

  const proxy = await getBuild();
  expect(proxy).toHaveBeenCalledTimes(1);
});

it('should call esbuild once even when functions have different entries (multi-entrypoint)', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
    {
      entry: 'file2.ts',
      func: {
        events: [],
        handler: 'file2.handler',
      },
      functionAlias: 'func2',
    },
  ];

  await bundle.call(esbuildPlugin({ functionEntries }));

  const proxy = await getBuild();
  expect(proxy).toHaveBeenCalledTimes(1);
});

it('should set buildResults after compilation is complete', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
    {
      entry: 'file2.ts',
      func: {
        events: [],
        handler: 'file2.handler',
      },
      functionAlias: 'func2',
    },
  ];

  const expectedResults: FunctionBuildResult[] = [
    {
      bundlePath: 'file1.js',
      func: { events: [], handler: 'file1.handler' },
      functionAlias: 'func1',
    },
    {
      bundlePath: 'file2.js',
      func: { events: [], handler: 'file2.handler' },
      functionAlias: 'func2',
    },
  ];

  const plugin = esbuildPlugin({ functionEntries });

  await bundle.call(plugin);

  expect(plugin.buildResults).toStrictEqual(expectedResults);
});

it('should build all unique entrypoints in a single esbuild call', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
  ];

  const plugin = esbuildPlugin({ functionEntries });

  await bundle.call(plugin);

  const proxy = await getBuild();
  expect(proxy).toHaveBeenCalledTimes(1);
  expect(proxy).toHaveBeenCalledWith(
    expect.objectContaining({
      entryPoints: ['file1.ts'],
      outdir: '/workdir/.esbuild',
      outbase: '.',
    })
  );
});

it('should filter out non esbuild options', async () => {
  const functionEntries: FunctionEntry[] = [
    {
      entry: 'file1.ts',
      func: {
        events: [],
        handler: 'file1.handler',
      },
      functionAlias: 'func1',
    },
  ];

  const plugin = esbuildPlugin({ functionEntries });

  await bundle.call(plugin);

  const config: any = {
    bundle: true,
    entryPoints: ['file1.ts'],
    external: ['aws-sdk'],
    outbase: '.',
    outdir: '/workdir/.esbuild',
    platform: 'node',
    plugins: [],
    target: 'node12',
  };

  const proxy = await getBuild();

  expect(proxy).toHaveBeenCalledWith(config);
});

describe('skipBundle', () => {
  it('should not call esbuild when skipBundle is true', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: Infinity,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: true,
      packagerOptions: {},
      platform: 'node',
      outputFileExtension: '.js',
      skipBundle: true,
    };

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    const proxy = await getBuild();
    expect(proxy).not.toHaveBeenCalled();
  });

  it('should still call prepare() when skipBundle is true', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: Infinity,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: true,
      packagerOptions: {},
      platform: 'node',
      outputFileExtension: '.js',
      skipBundle: true,
    };

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    expect(plugin.prepare).toHaveBeenCalledTimes(1);
  });

  it('should set correct buildResults when skipBundle is true', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: Infinity,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: true,
      packagerOptions: {},
      platform: 'node',
      outputFileExtension: '.js',
      skipBundle: true,
    };

    const expectedResults: FunctionBuildResult[] = [
      {
        bundlePath: 'file1.js',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        bundlePath: 'file2.js',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
    ];

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    expect(plugin.buildResults).toStrictEqual(expectedResults);
  });
});

describe('batched concurrency', () => {
  it('should make multiple esbuild calls when concurrency < entrypoints', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
      {
        entry: 'file3.ts',
        func: { events: [], handler: 'file3.handler' },
        functionAlias: 'func3',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: 2,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},
      platform: 'node',
      outputFileExtension: '.js',
    };

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    const proxy = await getBuild();
    expect(proxy).toHaveBeenCalledTimes(2);
    expect(proxy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ entryPoints: ['file1.ts', 'file2.ts'] })
    );
    expect(proxy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ entryPoints: ['file3.ts'] })
    );
  });

  it('should make a single esbuild call when concurrency >= entrypoints', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: 5,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},
      platform: 'node',
      outputFileExtension: '.js',
    };

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    const proxy = await getBuild();
    expect(proxy).toHaveBeenCalledTimes(1);
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({ entryPoints: ['file1.ts', 'file2.ts'] })
    );
  });

  it('should set correct buildResults with batched concurrency', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
      {
        entry: 'file3.ts',
        func: { events: [], handler: 'file3.handler' },
        functionAlias: 'func3',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: 2,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},
      platform: 'node',
      outputFileExtension: '.js',
    };

    const expectedResults: FunctionBuildResult[] = [
      {
        bundlePath: 'file1.js',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        bundlePath: 'file2.js',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
      {
        bundlePath: 'file3.js',
        func: { events: [], handler: 'file3.handler' },
        functionAlias: 'func3',
      },
    ];

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    expect(plugin.buildResults).toStrictEqual(expectedResults);
  });

  it('should build one at a time when concurrency is 1', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: 1,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},
      platform: 'node',
      outputFileExtension: '.js',
    };

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    const proxy = await getBuild();
    expect(proxy).toHaveBeenCalledTimes(2);
    expect(proxy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ entryPoints: ['file1.ts'] })
    );
    expect(proxy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ entryPoints: ['file2.ts'] })
    );
  });
});

describe('buildOption platform node', () => {
  it('should set buildResults buildPath after compilation is complete with default extension', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const expectedResults: FunctionBuildResult[] = [
      {
        bundlePath: 'file1.js',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        bundlePath: 'file2.js',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
    ];

    const plugin = esbuildPlugin({ functionEntries });

    await bundle.call(plugin);

    expect(plugin.buildResults).toStrictEqual(expectedResults);
  });

  it('should set buildResults buildPath after compilation is complete with ".cjs" extension', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: Infinity,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},
      platform: 'node',
      outputFileExtension: '.cjs',
    };

    const expectedResults: FunctionBuildResult[] = [
      {
        bundlePath: 'file1.cjs',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        bundlePath: 'file2.cjs',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
    ];

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    expect(plugin.buildResults).toStrictEqual(expectedResults);
  });

  it('should error when trying to use ".mjs" extension', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: Infinity,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},
      platform: 'node',
      outputFileExtension: '.mjs',
    };

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    const expectedError = 'ERROR: Non esm builds should not output a file with extension ".mjs".';

    try {
      await bundle.call(plugin);
    } catch (error) {
      expect(error).toHaveProperty('message', expectedError);
    }
  });
});

describe('buildOption platform neutral', () => {
  it('should set buildResults buildPath after compilation is complete with default extension', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: Infinity,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},
      platform: 'neutral',
      outputFileExtension: '.js',
    };

    const expectedResults: FunctionBuildResult[] = [
      {
        bundlePath: 'file1.js',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        bundlePath: 'file2.js',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
    ];

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    expect(plugin.buildResults).toStrictEqual(expectedResults);
  });

  it('should set buildResults buildPath after compilation is complete with ".mjs" extension', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: Infinity,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},
      platform: 'neutral',
      outputFileExtension: '.mjs',
    };

    const expectedResults: FunctionBuildResult[] = [
      {
        bundlePath: 'file1.mjs',
        func: { events: [], handler: 'file1.handler' },
        functionAlias: 'func1',
      },
      {
        bundlePath: 'file2.mjs',
        func: { events: [], handler: 'file2.handler' },
        functionAlias: 'func2',
      },
    ];

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    await bundle.call(plugin);

    expect(plugin.buildResults).toStrictEqual(expectedResults);
  });

  it('should error when trying to use ".cjs" extension', async () => {
    const functionEntries: FunctionEntry[] = [
      {
        entry: 'file1.ts',
        func: {
          events: [],
          handler: 'file1.handler',
        },
        functionAlias: 'func1',
      },
      {
        entry: 'file2.ts',
        func: {
          events: [],
          handler: 'file2.handler',
        },
        functionAlias: 'func2',
      },
    ];

    const buildOptions: Partial<Configuration> = {
      concurrency: Infinity,
      bundle: true,
      target: 'node12',
      external: [],
      exclude: ['aws-sdk'],
      nativeZip: false,
      packager: 'npm',
      installExtraArgs: [],
      watch: {},
      keepOutputDirectory: false,
      packagerOptions: {},
      platform: 'neutral',
      outputFileExtension: '.cjs',
    };

    const plugin = esbuildPlugin({ functionEntries, buildOptions: buildOptions as any });

    const expectedError = 'ERROR: format "esm" or platform "neutral" should not output a file with extension ".cjs".';

    try {
      await bundle.call(plugin);
    } catch (error) {
      expect(error).toHaveProperty('message', expectedError);
    }
  });
});
