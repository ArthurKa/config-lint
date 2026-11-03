'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.resolve('node_modules/@vitest/spy/dist/index.d.ts');
const filename = path.parse(__filename).base;

/** @param {boolean} isCheckMode */
module.exports = isCheckMode => {
  const fileLines = fs.readFileSync(filePath, 'utf-8').split('\n');

  if(fileLines[397]?.trim() === 'declare function fn<T extends Procedure | Constructable = Procedure>(originalImplementation?: T): Mock<T>;') {
    if(isCheckMode === true) {
      return 'update-needed';
    }

    fileLines.splice(397, 1, `${fileLines[397].replace('(originalImplementation?: T)', '(originalImplementation: T)')} // modified from \`${filename}\``);

    fs.writeFileSync(filePath, fileLines.join('\n'));
    console.info(`${filename} applied successfully.`);
  } else if(isCheckMode === false) {
    console.info(`${filename} WAS NOT APPLIED.`);
  }
};
