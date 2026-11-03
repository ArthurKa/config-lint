import type { Node } from 'jsonc-parser';
import type { Issue } from '../../types';
import { sort } from '../../utils/package-json/json';

export const topLevelOrder = (text: string, node: Node): Issue[] => sort(text, node, false);
