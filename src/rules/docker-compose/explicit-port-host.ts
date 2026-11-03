import type { ValueProblem } from '../../types';
import { hostValid } from '../../utils/docker-compose/validation';

export const portHost = (host: string, published: string, target: string, protocol: string | undefined): ValueProblem[] => {
  const result: ValueProblem[] = [];
  if(host === '') {
    result.push({ rule: 'docker-compose/explicit-port-host', message: 'Specify the host IP explicitly.', fixed: `127.0.0.1:${published}:${target}${protocol === undefined ? '' : `/${protocol}`}` });
  } else if(!hostValid(host, true)) {
    result.push({ rule: 'docker-compose/explicit-port-host', message: 'Host must be a valid IPv4 or IPv6 address.' });
  }

  return result;
};

export const hostSpecification = { key: 'host_ip', value: '127.0.0.1', rule: 'docker-compose/explicit-port-host', valid: (value: unknown): boolean => typeof value === 'string' && hostValid(value) };
