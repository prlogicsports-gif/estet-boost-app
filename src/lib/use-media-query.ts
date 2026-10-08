import { useSyncExternalStore } from "react";

/** Acompanha uma media query. No servidor e no primeiro render vale `false`. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (listener) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
