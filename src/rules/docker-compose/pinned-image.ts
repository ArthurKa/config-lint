import { isScalar, type YAMLMap } from 'yaml';
import type { Issue } from '../../types';
import { blocked, issueAt } from '../../utils/docker-compose/yaml';
import { isPinnedImage, unpinnedImageRange } from '../../utils/pinned-image';

export const pinnedImage = (mapping: YAMLMap | Map<string, unknown>): Issue[] => {
  const image = mapping instanceof Map ? mapping.get('image') : mapping.get('image', true);
  if(mapping.has('build') || !isScalar(image) || typeof image.value !== 'string' || blocked(image)) {
    return [];
  }
  if(isPinnedImage(image.value)) {
    return [];
  }

  const issue = issueAt('docker-compose/pinned-image', 'Pin pulled images to an explicit non-latest tag or digest.', image);
  const quoted = image.type === 'QUOTE_DOUBLE' || image.type === 'QUOTE_SINGLE';
  const end = issue.end - Number(quoted);
  const highlight = unpinnedImageRange(image.value);

  return [{ ...issue, start: Math.max(issue.start + Number(quoted), end - (highlight.end - highlight.start)), end }];
};
