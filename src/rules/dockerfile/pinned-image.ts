import type { Issue } from '../../types';
import { parseDockerfile } from '../../utils/dockerfile/parser';
import { isPinnedImage, unpinnedImageRange } from '../../utils/pinned-image';

export const pinnedImages = (text: string): Issue[] => {
  const { document, range } = parseDockerfile(text);
  const stages = new Set<string>();
  const issues: Issue[] = [];
  for(const instruction of document.getFROMs()) {
    const image = instruction.getImage();
    const imageRange = instruction.getImageRange();
    if(image !== null && image !== '' && imageRange && image !== 'scratch' && !stages.has(image.toLowerCase()) && !image.includes('$') && !isPinnedImage(image)) {
      const { end } = range(imageRange);
      const highlight = unpinnedImageRange(image);
      issues.push({ rule: 'dockerfile/pinned-image', message: 'Pin pulled images to an explicit non-latest tag or digest.', start: end - (highlight.end - highlight.start), end });
    }
    const stage = instruction.getBuildStage();
    if(stage !== null && stage !== '') {
      stages.add(stage.toLowerCase());
    }
  }

  return issues;
};
