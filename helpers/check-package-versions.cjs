'use strict';

const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const semver = require('semver');

/**
  @typedef PackageJson
  @type {{
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    workspaces?: string[];
  }}
*/

const { dependencies, devDependencies, workspaces = [] } = /** @type {PackageJson} */ (
  JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'))
);
const packageNames = (
  execSync(`ls -d ${workspaces.join(' ')}`)
    .toString('utf-8')
    .trim()
    .split('\n')
);

const allDependencies = packageNames.reduce((acc, cur) => {
  const { dependencies, devDependencies } = /** @type {PackageJson} */ (
    JSON.parse(fs.readFileSync(path.resolve(cur, 'package.json'), 'utf-8'))
  );

  return {
    ...acc,
    ...dependencies,
    ...devDependencies,
  };
}, { ...dependencies, ...devDependencies });

for(const [dependencyName, targetVersion] of Object.entries(allDependencies)) {
  /** @type {PackageJson} */
  const pkg = (() => {
    try {
      return /** @type {PackageJson} */ (
        JSON.parse(fs.readFileSync(path.resolve('node_modules', dependencyName, 'package.json'), 'utf-8'))
      );
    } catch(e) {
      assert(e instanceof Error, 'This should never happen. |rp0175|');

      if(/no such file or directory/ui.exec(e.message)) {
        console.error(`Dependency package ${dependencyName}@${targetVersion} is missing.\nTry to run \`npm run prune && npm ci\`.`);
        process.exit(1);
      }

      throw e;
    }
  })();

  const { version } = pkg;
  assert(version !== undefined, 'Something went wrong. |cn5gdk|');

  if(targetVersion.startsWith('github:')) {
    continue;
  }

  if(!semver.satisfies(version, targetVersion)) {
    console.error(`Dependency package ${dependencyName}@${version} doesn't match target ${targetVersion}.\nTry to run \`npm run prune && npm ci\`.`);
    process.exit(1);
  }
}
