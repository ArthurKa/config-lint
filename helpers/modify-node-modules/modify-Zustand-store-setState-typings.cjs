'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.resolve('node_modules/zustand/vanilla.d.ts');
const filename = path.parse(__filename).base;

/** @param {boolean} isCheckMode */
module.exports = isCheckMode => {
  const fileLines = fs.readFileSync(filePath, 'utf-8').split('\n');

  if(fileLines.slice(0, 8).join('\n').trim() === "type SetStateInternal<T> = {\n    _(partial: T | Partial<T> | {\n        _(state: T): T | Partial<T>;\n    }['_'], replace?: false): void;\n    _(state: T | {\n        _(state: T): T;\n    }['_'], replace: true): void;\n}['_'];") {
    if(isCheckMode === true) {
      return 'update-needed';
    }

    fileLines.splice(1, 6, `${fileLines[1]?.replace(' | {', '): void;') ?? ''} // modified from \`${filename}\``);

    fs.writeFileSync(filePath, fileLines.join('\n'));
    console.info(`${filename} applied successfully.`);
  } else if(isCheckMode === false) {
    console.info(`${filename} WAS NOT APPLIED.`);
  }
};
