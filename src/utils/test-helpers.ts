/* eslint-disable ts/no-unnecessary-condition -- Runtime assertions check parsed fixture values. */

import assert from 'assert/strict';
import { parseDocument } from 'yaml';
import { fix } from '../rules';

export const dockerCompose = (body: string): string => `services:\n  app:\n${body}`;
export const values = (text: string): unknown => parseDocument(text).toJS();
export const check = (input: string): string => {
  const result = fix(input, 'docker-compose');
  assert.equal(parseDocument(result).errors.length, 0, result);
  assert.equal(fix(result, 'docker-compose'), result);

  return result;
};
