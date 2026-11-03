'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.resolve('node_modules/@ionic/react/dist/types/lifecycle/hooks.d.ts');
const filename = path.parse(__filename).base;

/** @param {boolean} isCheckMode */
module.exports = isCheckMode => {
  const fileLines = fs.readFileSync(filePath, 'utf-8').split('\n');

  if(fileLines.slice(1, 5).join('\n').trim() === 'export declare const useIonViewWillEnter: (callback: LifeCycleCallback, deps?: any[]) => void;\nexport declare const useIonViewDidEnter: (callback: LifeCycleCallback, deps?: any[]) => void;\nexport declare const useIonViewWillLeave: (callback: LifeCycleCallback, deps?: any[]) => void;\nexport declare const useIonViewDidLeave: (callback: LifeCycleCallback, deps?: any[]) => void;') {
    if(isCheckMode === true) {
      return 'update-needed';
    }

    fileLines.splice(1, 1, `${fileLines[1]?.replace('deps?: any[]', 'deps: readonly unknown[]') ?? ''} // modified from \`${filename}\``);
    fileLines.splice(2, 1, `${fileLines[2]?.replace('deps?: any[]', 'deps: readonly unknown[]') ?? ''} // modified from \`${filename}\``);
    fileLines.splice(3, 1, `${fileLines[3]?.replace('deps?: any[]', 'deps: readonly unknown[]') ?? ''} // modified from \`${filename}\``);
    fileLines.splice(4, 1, `${fileLines[4]?.replace('deps?: any[]', 'deps: readonly unknown[]') ?? ''} // modified from \`${filename}\``);

    fs.writeFileSync(filePath, fileLines.join('\n'));
    console.info(`${filename} applied successfully.`);
  } else if(isCheckMode === false) {
    console.info(`${filename} WAS NOT APPLIED.`);
  }
};
