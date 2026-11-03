'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.resolve('node_modules/@vitest/expect/dist/index.d.ts');
const filename = path.parse(__filename).base;

/** @param {boolean} isCheckMode */
module.exports = isCheckMode => {
  const fileLines = fs.readFileSync(filePath, 'utf-8').split('\n');

  if(fileLines[280]?.trim() === 'toStrictEqual: <E>(expected: E) => void;') {
    if(isCheckMode === true) {
      return 'update-needed';
    }

    fileLines.splice(280, 1, `${fileLines[280].replace('<E>(expected: E)', '(expected: T)')} // modified from \`${filename}\``);

    fs.writeFileSync(filePath, fileLines.join('\n'));
    console.info(`${filename} applied successfully.`);
  } else if(isCheckMode === false) {
    console.info(`${filename} WAS NOT APPLIED.`);
  }
};
