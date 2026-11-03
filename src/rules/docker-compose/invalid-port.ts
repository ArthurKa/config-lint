import type { ValueProblem } from '../../types';

type PortContext = { targetRange: number[] | undefined; hostRange: number[] | undefined; rest: string[]; published: string; target: string };
export const invalidPort = ({ targetRange, hostRange, rest, published, target }: PortContext): ValueProblem[] => {
  if(!targetRange || !hostRange || rest.length > 0) {
    return [{ rule: 'docker-compose/invalid-port', message: 'Invalid port mapping; choose a valid port or range.' }];
  }
  if(published.includes('-') && target.includes('-') && (targetRange[1] ?? 0) - (targetRange[0] ?? 0) !== (hostRange[1] ?? 0) - (hostRange[0] ?? 0)) {
    return [{ rule: 'docker-compose/invalid-port', message: 'Host and container ranges must have equal lengths.' }];
  }
  if(!published.includes('-') && published !== '' && target.includes('-')) {
    return [{ rule: 'docker-compose/invalid-port', message: 'A container range needs a matching host range.' }];
  }

  return [];
};
