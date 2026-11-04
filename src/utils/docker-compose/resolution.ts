import { type Document, isAlias, isMap, isNode, isScalar, isSeq, visit, type YAMLMap } from 'yaml';

export type ScalarPath = Array<string | number>;
export const mergePair = (key: unknown): boolean => isScalar(key) && key.value === '<<' && key.type === 'PLAIN';

// Keep source nodes: diagnostics and edits belong to definitions, not expanded copies.
export const composeResolver = (document: Document) => {
  let remaining = 10000;
  const resolve = (node: unknown): unknown => isAlias(node) ? node.resolve(document) : node;
  const entries = (node: unknown, ancestors = new Set<unknown>()): { fields: Map<string, unknown>; mappings: Set<YAMLMap>; complete: boolean } => {
    const result = { fields: new Map<string, unknown>(), mappings: new Set<YAMLMap>(), complete: true };
    remaining--;
    const mapping = resolve(node);
    if(remaining < 0 || ancestors.size > 100 || ancestors.has(mapping) || !isMap(mapping) || mapping.tag !== undefined) {
      result.complete = false;

      return result;
    }
    const next = new Set(ancestors).add(mapping);
    result.mappings.add(mapping);
    for(const pair of mapping.items) {
      if(!isScalar(pair.key) || typeof pair.key.value !== 'string') {
        result.complete = false;
      } else if(!mergePair(pair.key)) {
        result.fields.set(pair.key.value, pair.value);
      }
    }
    for(const pair of mapping.items) {
      if(!mergePair(pair.key)) {
        continue;
      }
      const source = resolve(pair.value);
      for(const item of isSeq(source) ? source.items : [source]) {
        const inherited = entries(item, next);
        result.complete &&= inherited.complete;
        for(const mapping of inherited.mappings) {
          result.mappings.add(mapping);
        }
        for(const [key, value] of inherited.fields) {
          if(!result.fields.has(key)) {
            result.fields.set(key, value);
          }
        }
      }
    }

    return result;
  };

  return { resolve, entries };
};

// Extension blocks store fragments; only actual consumer paths assign them a type.
export const nodePaths = (document: Document): Map<unknown, Array<ScalarPath | null>> => {
  const paths = new Map<unknown, Array<ScalarPath | null>>();
  const resolver = composeResolver(document);
  let remaining = 10000;
  const state = { complete: true };
  const walk = (input: unknown, path: ScalarPath | null, ancestors: Set<unknown>): void => {
    const node = resolver.resolve(input);
    if(!isNode(node)) {
      if(isAlias(input)) {
        state.complete = false;
      }
      return;
    }
    remaining--;
    if(remaining < 0 || ancestors.size > 100 || ancestors.has(node)) {
      state.complete = false;
      return;
    }
    const next = new Set(ancestors).add(node);
    const context = node.tag === undefined ? path : null;
    const usages = paths.get(node) ?? [];
    usages.push(context);
    paths.set(node, usages);
    if(isSeq(node)) {
      for(const [index, item] of node.items.entries()) {
        walk(item, context === null ? null : [...context, index], next);
      }
    }
    if(isMap(node)) {
      if(node.tag !== undefined) {
        for(const pair of node.items) {
          walk(pair.key, null, next);
          walk(pair.value, null, next);
        }
        return;
      }
      const effective = resolver.entries(node);
      state.complete &&= effective.complete;
      for(const pair of node.items) {
        walk(pair.key, null, next);
      }
      for(const [key, value] of effective.fields) {
        if(!(key.startsWith('x-') && (context?.length === 0 || (context?.length === 2 && context[0] === 'services')))) {
          walk(value, context === null ? null : [...context, key], next);
        }
      }
    }
  };
  walk(document.contents, [], new Set());
  // Mapping keys are real uses even inside extension storage or overridden fragments.
  visit(document, (key, node) => {
    if(key === 'key') {
      const source = resolver.resolve(node);
      if(isNode(source)) {
        const usages = paths.get(source) ?? [];
        usages.push(null);
        paths.set(source, usages);
      }
    }
  });
  if(!state.complete) {
    paths.clear();
  }

  return paths;
};
