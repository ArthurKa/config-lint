import type { ValueProblem } from '../../types';

export const volumeMode = (value: string, hasOptions: boolean, options: string[]): ValueProblem[] => {
  if(hasOptions && options.includes('ro') && options.includes('rw')) {
    return [{ rule: 'docker-compose/explicit-volume-mode', message: 'Choose either ro or rw, not both.' }];
  }
  if(hasOptions && (options.includes('ro') || options.includes('rw'))) {
    return [];
  }

  return [{ rule: 'docker-compose/explicit-volume-mode', message: 'Specify ro or rw explicitly.', fixed: value + (hasOptions ? ',ro' : ':ro') }];
};

export const modeSpecification = { key: 'read_only', value: 'true', rule: 'docker-compose/explicit-volume-mode', valid: (value: unknown): boolean => typeof value === 'boolean' };
