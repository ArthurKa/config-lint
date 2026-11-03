'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.resolve('node_modules/react-error-boundary/dist/declarations/src/types.d.ts');
const filename = path.parse(__filename).base;

/** @param {boolean} isCheckMode */
module.exports = isCheckMode => {
  const fileLines = fs.readFileSync(filePath, 'utf-8').split('\n');

  if(fileLines.slice(1, 5).join('\n').trim() === 'export type FallbackProps = {\n    error: any;\n    resetErrorBoundary: (...args: any[]) => void;\n};') {
    if(isCheckMode === true) {
      return 'update-needed';
    }

    fileLines.splice(2, 1, `${fileLines[2]?.replace('any', 'unknown') ?? ''} // modified from \`${filename}\``);
    fileLines.splice(3, 1, `${fileLines[3]?.replace('any', 'unknown') ?? ''} // modified from \`${filename}\``);

    fs.writeFileSync(filePath, fileLines.join('\n'));
    console.info(`${filename} applied successfully.`);
  } else if(isCheckMode === false) {
    console.info(`${filename} WAS NOT APPLIED.`);
  }
};
