export const rank = (key: string, top: string[], bottom: string[]): number => {
  if(top.includes(key)) {
    return top.indexOf(key);
  }
  if(bottom.includes(key)) {
    return top.length + 1 + bottom.indexOf(key);
  }

  return top.length;
};
export const dynamic = (value: string): boolean => /\$[\w{$]/u.test(value);

// Locate the first property whose position differs from the required order.
export const firstOrderingChange = <T>(original: T[], sorted: T[]): T | undefined => original.find((e, i) => e !== sorted[i]);
