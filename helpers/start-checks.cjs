'use strict';

const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const nvmrc = fs.readFileSync(path.resolve('.nvmrc'), 'utf-8').trim();

const { node } = process.versions;
assert(node === nvmrc, `You must use Node.js v${nvmrc} for this project (${node} used)`);

const npmVersion = execSync('npm -v').toString().trim();
assert(Number(npmVersion.split('.')[0]) === 10, `You must use NPM v10.x.x (${npmVersion} used)`);
