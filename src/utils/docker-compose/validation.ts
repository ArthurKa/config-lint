import { isIP } from 'net';
import { dockerComposeProtocols } from '../../constants';

export const hostValid = (value: string, brackets = false): boolean => {
  if(value.startsWith('[') || value.endsWith(']')) {
    return brackets && value.startsWith('[') && value.endsWith(']') && isIP(value.slice(1, -1)) === 6;
  }

  return isIP(value) !== 0;
};
export const protocolValid = (value: string): boolean => dockerComposeProtocols.includes(value.toLowerCase());
