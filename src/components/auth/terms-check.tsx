import type { ReactNode } from "react";

export function TermsCheck({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="mt-[18px] flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-[18px] flex-none accent-[var(--teal)]"
      />
      <span className="text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">{children}</span>
    </label>
  );
}

export function AuthTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <>
      <h1 className="text-[26px] font-medium leading-[1.2] tracking-[-0.015em] text-foreground">
        {title}
      </h1>
      {children ? (
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-[var(--text-secondary)]">
          {children}
        </p>
      ) : null}
    </>
  );
}

export const authLink = "text-[var(--nude-sand)] underline-offset-4 hover:underline";
