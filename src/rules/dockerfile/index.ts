import type { Issue } from '../../types';
import { applyDirectives } from '../../utils/dockerfile/directives';
import { pinnedImages } from './pinned-image';

export const dockerfileIssues = (text: string): Issue[] => applyDirectives(text, pinnedImages(text));
