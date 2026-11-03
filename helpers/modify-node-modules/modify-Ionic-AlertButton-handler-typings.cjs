'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.resolve('node_modules/@ionic/core/dist/types/components/alert/alert-interface.d.ts');
const filename = path.parse(__filename).base;

/** @param {boolean} isCheckMode */
module.exports = isCheckMode => {
  const fileLines = fs.readFileSync(filePath, 'utf-8').split('\n');

  if(fileLines.slice(53, 54).join('\n').trim() === 'handler?: (value: any) => AlertButtonOverlayHandler | Promise<AlertButtonOverlayHandler>;') {
    if(isCheckMode === true) {
      return 'update-needed';
    }

    fileLines.splice(53, 1, `${fileLines[53]?.replace('value: any', 'value: unknown') ?? ''} // modified from \`${filename}\``);

    fs.writeFileSync(filePath, fileLines.join('\n'));
    console.info(`${filename} applied successfully.`);
  } else if(isCheckMode === false) {
    console.info(`${filename} WAS NOT APPLIED.`);
  }
};
