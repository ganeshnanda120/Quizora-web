/**
 * Router utility functions
 */

export const parseQueryParams = (searchStr = '') => {
  const params = {};
  const query = searchStr.startsWith('?') ? searchStr.slice(1) : searchStr;
  if (!query) return params;

  query.split('&').forEach((pair) => {
    if (!pair) return;
    const [rawKey, rawVal] = pair.split('=');
    const key = decodeURIComponent(rawKey || '');
    const val = decodeURIComponent(rawVal || '');
    if (key) params[key] = val;
  });

  return params;
};

export const matchRoute = (pattern, pathname) => {
  const [cleanPattern] = pattern.split('?');
  const [cleanPathname] = (pathname || '').split('?');

  const patternSegments = cleanPattern.split('/').filter(Boolean);
  const pathSegments = cleanPathname.split('/').filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const pSeg = patternSegments[i];
    const actualSeg = pathSegments[i];

    if (pSeg.startsWith(':')) {
      const paramName = pSeg.slice(1);
      params[paramName] = actualSeg;
    } else if (pSeg !== actualSeg) {
      return null;
    }
  }

  return params;
};
