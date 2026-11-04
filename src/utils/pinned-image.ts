export const isPinnedImage = (value: string): boolean => {
  const digestIndex = value.indexOf('@');
  if(digestIndex >= 0) {
    if(/^[^\s:@/]+:[^\s:@/]+$/u.test(value.slice(digestIndex + 1))) {
      return true;
    }
  } else {
    const tagIndex = value.lastIndexOf(':');
    const tag = value.slice(tagIndex + 1);
    if(tagIndex > value.lastIndexOf('/') && tag !== '' && tag !== 'latest') {
      return true;
    }
  }

  return false;
};

export const unpinnedImageRange = (value: string): { start: number; end: number } => {
  const end = value.length;
  const digestIndex = value.indexOf('@');
  const tagIndex = value.lastIndexOf(':');
  const separator = (
    digestIndex >= 0
      ? digestIndex
      : tagIndex > value.lastIndexOf('/')
        ? tagIndex
        : -1
  );

  return { start: separator >= 0 && separator + 1 < end ? separator + 1 : Math.max(0, end - 1), end };
};
