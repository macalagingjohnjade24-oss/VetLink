import { useCallback, useEffect, useRef, useState } from 'react';

type State<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

/**
 * Minimal request hook: runs `load` whenever `deps` change and exposes an
 * explicit reload. Kept local instead of adding a data-fetching dependency to
 * a console that only needs read + reload.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    let alive = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    loader
      .current()
      .then((data) => {
        if (alive) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setState({
          data: null,
          error: error instanceof Error ? error.message : String(error),
          loading: false,
        });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { ...state, reload };
}
