'use strict';

const fs = require('fs');
const path = require('path');

/** @param {boolean} isCheckMode */
module.exports = isCheckMode => {
  {
    const filePath = path.resolve('node_modules/@types/node/timers.d.ts');
    const filename = path.parse(__filename).base;
    const fileLines = fs.readFileSync(filePath, 'utf-8').split('\n');

    if(fileLines[237]?.trim() === `function ${['set', 'Timeout'].join('')}(callback: (_: void) => void, delay?: number): NodeJS.Timeout;`) {
      if(isCheckMode === true) {
        return 'update-needed';
      }

      fileLines.splice(237, 1, `${fileLines[237].replace('delay?: number', 'delay: number')} // modified from \`${filename}\``);

      fs.writeFileSync(filePath, fileLines.join('\n'));
      console.info(`${filename} applied successfully.`);
    } else if(isCheckMode === false) {
      console.info(`${filename} WAS NOT APPLIED.`);
    }

    if(fileLines.slice(229, 234).join('\n').trim() === 'function setTimeout<TArgs extends any[]>(\n            callback: (...args: TArgs) => void,\n            delay?: number,\n            ...args: TArgs\n        ): NodeJS.Timeout;') {
      if(isCheckMode === true) {
        return 'update-needed';
      }

      fileLines.splice(231, 1, `${fileLines[231]?.replace('delay?: number', 'delay: number') ?? ''} // modified from \`${filename}\``);

      fs.writeFileSync(filePath, fileLines.join('\n'));
      console.info(`${filename} applied successfully.`);
    } else if(isCheckMode === false) {
      console.info(`${filename} WAS NOT APPLIED.`);
    }
  }

  {
    const filePath = path.resolve('node_modules/typescript/lib/lib.dom.d.ts');
    const filename = path.parse(__filename).base;
    const fileLines = fs.readFileSync(filePath, 'utf-8').split('\n');

    if(fileLines[29336]?.trim() === `declare function ${['set', 'Timeout'].join('')}(handler: TimerHandler, timeout?: number, ...arguments: any[]): number;`) {
      if(isCheckMode === true) {
        return 'update-needed';
      }

      fileLines.splice(29336, 1, `${fileLines[29336].replace('timeout?: number', 'timeout: number')} // modified from \`${filename}\``);

      fs.writeFileSync(filePath, fileLines.join('\n'));
      console.info(`${filename} applied successfully.`);
    } else if(isCheckMode === false) {
      console.info(`${filename} WAS NOT APPLIED.`);
    }
  }
};
