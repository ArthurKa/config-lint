export const portRange = (value: string, host = false): number[] | undefined => {
  if(host && value === '') {
    return [0, 0];
  }
  if(!/^\d+(?:-\d+)?$/u.test(value)) {
    return undefined;
  }
  const [start = -1, end = start] = value.split('-').map(Number);
  if(start < (host ? 0 : 1) || end > 65535 || end < start) {
    return undefined;
  }

  return [start, end];
};
