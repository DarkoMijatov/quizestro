import { useEffect } from 'react';

/** Wrapper that forces dark theme while mounted. Used for public pages. */
export function ForceDarkTheme({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, []);

  return <>{children}</>;
}
