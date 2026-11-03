import type { ValueProblem } from '../../types';
import { protocolValid } from '../../utils/docker-compose/validation';

export const portProtocol = (address: string, protocol: string | undefined): ValueProblem[] => {
  const result: ValueProblem[] = [];
  if(protocol === undefined) {
    result.push({ rule: 'docker-compose/explicit-port-protocol', message: 'Specify the port protocol explicitly.', fixed: `${address}/tcp` });
  } else if(!protocolValid(protocol)) {
    result.push({ rule: 'docker-compose/explicit-port-protocol', message: 'Use a valid port protocol: tcp, udp, or sctp.' });
  }

  return result;
};

export const protocolSpecification = { key: 'protocol', value: 'tcp', rule: 'docker-compose/explicit-port-protocol', valid: (value: unknown): boolean => typeof value === 'string' && protocolValid(value) };
