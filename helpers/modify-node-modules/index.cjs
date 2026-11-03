'use strict';

const isCheckMode = process.argv.includes('--check');

[
  require('./modify-useEffect-typings.cjs'),
  require('./modify-Number-isNaN-typings.cjs'),
  require('./modify-setTimeout-typings.cjs'),
  require('./modify-setInterval-typings.cjs'),
  require('./modify-Array-filter-typings.cjs'),
  require('./modify-Array-every-typings.cjs'),
  require('./modify-Array-some-typings.cjs'),
  require('./modify-Array-find-typings.cjs'),
  require('./modify-Array-findIndex-typings.cjs'),
  require('./modify-Array-findLast-typings.cjs'),
  require('./modify-Array-findLastIndex-typings.cjs'),
  require('./modify-Zustand-store-setState-typings.cjs'),
  require('./modify-Zod-v4-custom.cjs'),
  require('./modify-Ionic-useIonViewWill_Did_Enter_Leave-typings.cjs'),
  require('./modify-Ionic-AlertButton-handler-typings.cjs'),
  require('./modify-react-ErrorBoundary-typings.cjs'),
  require('./modify-total-typescript-ts-reset.cjs'),
  require('./modify-Vitest-toEqual-typings.cjs'),
  require('./modify-Vitest-toStrictEqual-typings.cjs'),
  require('./modify-Vitest-toBe-typings.cjs'),
  require('./modify-Vitest-toMatchObject-typings.cjs'),
  require('./modify-Vitest-spy-fn-typings.cjs'),
  require('./modify-Vitest-toBeNull-typings.cjs'),
// eslint-disable-next-line etc-misc/no-foreach
].forEach(f => {
  /** @type {ReturnType<typeof f> | null} */
  let result = null;
  try {
    result = f(isCheckMode);
  } catch {}

  if(result === 'update-needed') {
    console.error('Modifying node_modules needed. Try to run `npm run prune && npm ci`.');
    process.exit(1);
  }
});
