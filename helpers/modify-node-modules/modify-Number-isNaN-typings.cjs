'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.resolve('node_modules/typescript/lib/lib.es2015.core.d.ts');
const filename = path.parse(__filename).base;

/** @param {boolean} isCheckMode */
module.exports = isCheckMode => {
  const fileLines = fs.readFileSync(filePath, 'utf-8').split('\n');

  if(fileLines[240]?.trim() === 'isNaN(number: unknown): boolean;') {
    if(isCheckMode === true) {
      return 'update-needed';
    }

    fileLines.splice(240, 1, `${fileLines[240].replace('number: unknown', 'number: number')} // modified from \`${filename}\``);

    fs.writeFileSync(filePath, fileLines.join('\n'));
    console.info(`${filename} applied successfully.`);
  } else if(isCheckMode === false) {
    console.info(`${filename} WAS NOT APPLIED.`);
  }
};
