import type { ValueProblem } from '../../types';

export const invalidVolume = (paths: string[], target: string, parts: string[], hasOptions: boolean): ValueProblem[] => {
  if(paths.length > 2 || paths.some(e => e === '') || !/^(?:\/|[a-z]:[\\/])/iu.test(target) || (parts.length > 2 && !hasOptions)) {
    return [{ rule: 'docker-compose/invalid-volume', message: 'Invalid or unsupported volume mapping; specify a valid container path and mount options.' }];
  }

  return [];
};
