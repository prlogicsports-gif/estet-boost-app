function Bar({ width, height, rounded }: { width: string; height: string; rounded?: string }) {
  return (
    <span
      className="relative block overflow-hidden bg-[var(--eb-ivory-a06)]"
      style={{ width, height, borderRadius: rounded ?? "var(--radius-xs, 6px)" }}
    >
      <span
        className="absolute inset-0 -translate-x-full"
        style={{
          background: "linear-gradient(90deg, transparent, var(--eb-ivory-a10), transparent)",
          animation: "shimmer 1.4s cubic-bezier(.65,0,.35,1) infinite",
        }}
      />
    </span>
  );
}

export function Skeleton({ variant = "card" }: { variant?: "card" | "avatar" | "line" }) {
  if (variant === "avatar") return <Bar width="44px" height="44px" rounded="999px" />;
  if (variant === "line") return <Bar width="100%" height="12px" />;
  return (
    <div
      aria-hidden
      className="flex flex-col gap-2.5 rounded-[var(--radius-lg)] border border-[var(--border-hairline)] bg-[var(--surface-card)] p-4"
    >
      <Bar width="45%" height="13px" />
      <Bar width="80%" height="17px" />
      <Bar width="60%" height="13px" />
    </div>
  );
}
