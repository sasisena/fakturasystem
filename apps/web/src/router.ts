import { useEffect, useState } from 'react';

// Minimal hash-router: #/fakturaer/12 → ['fakturaer', '12']. Holder appen uten ekstra avhengigheter.

const parse = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);

export function useRoute(): string[] {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const navigate = (path: string) => {
  window.location.hash = path;
};
