import { isScalar, type YAMLMap } from 'yaml';
import { dockerComposeVolumeOptions } from '../../constants';
import type { Issue, ValueProblem } from '../../types';
import { portRange } from '../../utils/docker-compose/values';
import { addProperty, blocked, issueAt } from '../../utils/docker-compose/yaml';
import { hostSpecification, portHost } from './explicit-port-host';
import { portProtocol, protocolSpecification } from './explicit-port-protocol';
import { modeSpecification, volumeMode } from './explicit-volume-mode';
import { invalidPort } from './invalid-port';
import { invalidVolume } from './invalid-volume';

export const portProblems = (value: string): ValueProblem[] => {
  const [address = '', protocol, ...rest] = value.split('/');
  const parts = address.split(':');
  const target = parts.pop() ?? '';
  const published = parts.pop() ?? '';
  const host = parts.join(':');
  const targetRange = portRange(target);
  const hostRange = portRange(published, true);
  const invalid = invalidPort({ targetRange, hostRange, rest, published, target });
  if(invalid.length > 0) {
    return invalid;
  }
  const result: ValueProblem[] = [];
  result.push(...portHost(host, published, target, protocol), ...portProtocol(address, protocol));
  if(result.some(e => e.fixed === undefined)) {
    return result.map(({ rule, message }) => ({ rule, message }));
  }

  return result;
};
export const volumeProblems = (value: string): ValueProblem[] => {
  // Colons following a drive letter are part of a Windows path, not separators.
  const parts: string[] = [];
  let segment = '';
  for(let index = 0; index < value.length; index++) {
    const char = value[index] ?? '';
    const drive = /^[a-z]$/iu.test(segment) && /[\\/]/u.test(value[index + 1] ?? '');
    if(char === ':' && !drive) {
      parts.push(segment);
      segment = '';
    } else {
      segment += char;
    }
  }
  parts.push(segment);
  const last = parts.at(-1) ?? '';
  const options = last.split(',');
  const hasOptions = parts.length > 1 && options.every(e => dockerComposeVolumeOptions.has(e));
  const paths = hasOptions ? parts.slice(0, -1) : parts;
  const target = paths.at(-1) ?? '';
  const invalid = invalidVolume(paths, target, parts, hasOptions);
  if(invalid.length > 0) {
    return invalid;
  }

  return volumeMode(value, hasOptions, options);
};

export const longIssues = (text: string, entry: YAMLMap, field: string): Issue[] => {
  if(blocked(entry)) {
    return [];
  }
  const specifications = field === 'volumes' ? [modeSpecification] : [hostSpecification, protocolSpecification];

  return specifications.flatMap(e => {
    if(!entry.has(e.key)) {
      const edit = addProperty(text, entry, e.key, e.value);
      const issue = issueAt(e.rule, `Specify ${e.key} explicitly.`, entry, edit);
      if(edit && e.key !== 'protocol') {
        issue.start = edit.start;
        issue.end = edit.start;
      }

      return [issue];
    }
    const value = entry.get(e.key, true);

    return isScalar(value) && e.valid(value.value) ? [] : [issueAt(e.rule, `Invalid ${e.key}; choose a valid explicit value.`, value ?? entry)];
  });
};
