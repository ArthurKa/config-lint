'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.resolve('node_modules/@types/react/index.d.ts');
const filename = path.parse(__filename).base;

/** @param {boolean} isCheckMode */
module.exports = isCheckMode => {
  const fileLines = fs.readFileSync(filePath, 'utf-8').split('\n');

  if(fileLines[1769]?.trim() === 'function useEffect(effect: EffectCallback, deps?: DependencyList): void;') {
    if(isCheckMode === true) {
      return 'update-needed';
    }

    fileLines.splice(1769, 1, `${fileLines[1769].replace('deps?: DependencyList', 'deps: DependencyList | undefined')} // modified from \`${filename}\``);

    fs.writeFileSync(filePath, fileLines.join('\n'));
    console.info(`${filename} applied successfully.`);
  } else if(isCheckMode === false) {
    console.info(`${filename} WAS NOT APPLIED.`);
  }
};
