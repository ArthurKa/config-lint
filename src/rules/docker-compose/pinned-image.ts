import { isScalar, type YAMLMap } from 'yaml';
import type { Issue } from '../../types';
import { blocked, issueAt } from '../../utils/docker-compose/yaml';

export const pinnedImage = (mapping: YAMLMap): Issue[] => {
  const image = mapping.get('image', true);
  if(mapping.has('build') || !isScalar(image) || typeof image.value !== 'string' || blocked(image)) {
    return [];
  }
  const { value } = image;
  const digestIndex = value.indexOf('@');
  if(digestIndex >= 0) {
    if(/^[^\s:@/]+:[^\s:@/]+$/u.test(value.slice(digestIndex + 1))) {
      return [];
    }
  } else {
    const tagIndex = value.lastIndexOf(':');
    const tag = value.slice(tagIndex + 1);
    if(tagIndex > value.lastIndexOf('/') && tag !== '' && tag !== 'latest') {
      return [];
    }
  }

  return [issueAt('docker-compose/pinned-image', 'Pin pulled images to an explicit non-latest tag or digest.', image)];
};
