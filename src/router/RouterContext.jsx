import { useState, useEffect, useCallback, useMemo } from 'react';
import { RouterContext, useRouter } from './useRouter';
import { parseQueryParams } from './routerUtils';

export function RouterProvider({ children }) {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname || '/');
  const [currentSearch, setCurrentSearch] = useState(() => window.location.search || '');

  // Synchronize on browser Back / Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      setCurrentSearch(window.location.search || '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /**
   * Programmatic navigation
   * @param {string} to Destination path, optionally with search query
   * @param {object} [options]
   * @param {boolean} [options.replace] Replace current history entry instead of pushing
   * @param {any} [options.state] State to associate with history entry
   */
  const navigate = useCallback((to, options = {}) => {
    if (!to) return;

    let target = to;
    if (!target.startsWith('/')) {
      target = '/' + target;
    }

    const [targetPath, targetSearch = ''] = target.split('?');
    const fullSearch = targetSearch ? `?${targetSearch}` : '';
    const fullUrl = `${targetPath}${fullSearch}`;

    const currentFull = `${window.location.pathname}${window.location.search}`;

    if (options.replace) {
      if (currentFull !== fullUrl) {
        window.history.replaceState(options.state || {}, '', fullUrl);
      }
    } else {
      if (currentFull !== fullUrl) {
        window.history.pushState(options.state || {}, '', fullUrl);
      }
    }

    setCurrentPath(targetPath);
    setCurrentSearch(fullSearch);

    // Scroll to top on route change unless specified
    if (!options.preventScrollReset) {
      window.scrollTo(0, 0);
    }
  }, []);

  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  const goForward = useCallback(() => {
    window.history.forward();
  }, []);

  const query = useMemo(() => parseQueryParams(currentSearch), [currentSearch]);

  const contextValue = useMemo(() => ({
    currentPath,
    currentSearch,
    query,
    navigate,
    goBack,
    goForward
  }), [currentPath, currentSearch, query, navigate, goBack, goForward]);

  return (
    <RouterContext.Provider value={contextValue}>
      {children}
    </RouterContext.Provider>
  );
}

/**
 * Declarative navigation Link component
 */
export function Link({ to, children, className, onClick, replace = false, target, ...props }) {
  const { navigate } = useRouter();

  const handleClick = (e) => {
    if (onClick) onClick(e);

    // Check if link should be handled natively (Ctrl+click, external target, right click, etc.)
    if (
      !e.defaultPrevented &&
      e.button === 0 &&
      (!target || target === '_self') &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.shiftKey
    ) {
      e.preventDefault();
      navigate(to, { replace });
    }
  };

  return (
    <a href={to} onClick={handleClick} className={className} target={target} {...props}>
      {children}
    </a>
  );
}

