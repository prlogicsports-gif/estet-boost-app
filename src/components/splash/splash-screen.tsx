import { useEffect, useState } from "react";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = reduced ? 600 : 2500;
    const out = window.setTimeout(() => setLeaving(true), Math.max(total - 320, 200));
    const done = window.setTimeout(onDone, total);
    return () => {
      window.clearTimeout(out);
      window.clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-300"
      style={{ opacity: leaving ? 0 : 1 }}
      aria-hidden
    >
      <span className="flex items-baseline text-4xl leading-none sm:text-5xl">
        <span className="font-light text-foreground">E</span>
        <span
          className="overflow-hidden whitespace-nowrap font-light text-foreground"
          style={{ animation: "splash-estet 520ms ease-out 500ms both" }}
        >
          stet
        </span>
        <span className="font-medium text-primary">B</span>
        <span
          className="overflow-hidden whitespace-nowrap font-medium text-primary"
          style={{ animation: "splash-boost 520ms ease-out 1080ms both" }}
        >
          oost
        </span>
        <span className="font-medium text-[var(--teal)]">.</span>
      </span>
    </div>
  );
}
