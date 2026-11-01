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

/**
 * Validates whether a redirect path is a safe, internal relative URL.
 * Rejects protocol-relative URLs (//), external URLs (http:, https:), javascript:, etc.
 * Accepts paths starting with /activity/, /dashboard, /admin, or /profile.
 * @param {string|null|undefined} rawTarget 
 * @returns {string|null} Safe relative path or null
 */
export const getSafeRedirectUrl = (rawTarget) => {
  if (!rawTarget || typeof rawTarget !== 'string') return null;
  const trimmed = rawTarget.trim();

  // Must begin with a single '/' and not '//' or backslashes
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return null;
  }

  // Prevent protocol tricks
  if (/^\/[/\\]/.test(trimmed)) {
    return null;
  }

  // Extract path without query/hash for validation
  const [pathname] = trimmed.split(/[?#]/);

  // Allow internal activity links or dashboard/profile/admin routes
  if (
    pathname.startsWith('/activity/') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/profile')
  ) {
    return trimmed;
  }

  return null;
};

