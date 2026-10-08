import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "@/components/eb/icon-button";
import { cn } from "@/lib/utils";

/** Tecla Escape fecha a superfície aberta. */
function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

function Scrim({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="absolute inset-0 bg-[rgba(20,14,17,.58)]"
      style={{ animation: "fade-in 280ms cubic-bezier(.16,1,.3,1)" }}
    />
  );
}

function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

type SurfaceProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | undefined;
  children?: ReactNode;
  footer?: ReactNode;
};

/** Painel lateral, para fluxos em desktop e tablet (novo agendamento, detalhes). */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 440,
}: SurfaceProps & { width?: number }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[65] flex justify-end">
        <Scrim onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="relative flex h-full w-full flex-col border-l border-[var(--border-card)] bg-[var(--surface-raised)]"
          style={{
            maxWidth: width,
            boxShadow: "var(--shadow-float)",
            animation: "drawer-in 280ms cubic-bezier(.16,1,.3,1)",
          }}
        >
          <div className="flex items-start gap-3 border-b border-[var(--border-hairline)] px-5 pb-3.5 pt-5">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-medium tracking-[-0.01em]">{title}</h2>
              {subtitle ? (
                <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            <IconButton icon="X" label="Fechar" size={44} onClick={onClose} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-[18px]">{children}</div>
          {footer ? (
            <div className="flex gap-2.5 border-t border-[var(--border-hairline)] px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}

/** Janela de confirmação. */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 520,
  tone = "default",
}: SurfaceProps & { width?: number; tone?: "default" | "danger" }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[70] grid place-items-center p-5">
        <Scrim onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="relative w-full rounded-[var(--radius-2xl)] border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] backdrop-blur-[22px] backdrop-saturate-[1.15]"
          style={{
            maxWidth: width,
            boxShadow: "var(--glass-shadow), var(--glass-highlight)",
            animation: "fade-up 280ms cubic-bezier(.16,1,.3,1)",
          }}
        >
          <div className="flex items-start gap-3 px-[22px] pb-1.5 pt-[22px]">
            {tone === "danger" ? (
              <span className="grid size-9 flex-none place-items-center rounded-full bg-[var(--eb-coral-a16)] text-lg text-[var(--eb-coral-500)]">
                !
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-medium tracking-[-0.01em]">{title}</h2>
              {subtitle ? (
                <p className="mt-1 text-[13.5px] text-[var(--text-secondary)]">{subtitle}</p>
              ) : null}
            </div>
            <IconButton icon="X" label="Fechar" size={44} onClick={onClose} />
          </div>
          {children ? <div className="px-[22px] pt-3">{children}</div> : null}
          {footer ? (
            <div className="flex justify-end gap-2.5 px-[22px] pb-[22px] pt-5">{footer}</div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}

/** Painel de baixo, no celular. */
export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
  tall,
}: SurfaceProps & { className?: string; tall?: boolean }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end">
        <Scrim onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "relative flex w-full flex-col rounded-t-[var(--radius-2xl)] border border-b-0 border-[var(--glass-border)] bg-[var(--glass-bg-strong)] backdrop-blur-[22px] backdrop-saturate-[1.15]",
            tall ? "h-[calc(100dvh-env(safe-area-inset-top)-12px)]" : "max-h-[78%]",
            className,
          )}
          style={{
            boxShadow: "var(--shadow-sheet), var(--glass-highlight)",
            animation: "sheet-in 280ms cubic-bezier(.16,1,.3,1)",
          }}
        >
          <div className="grid place-items-center pt-2.5">
            <span className="h-1 w-[38px] rounded-full bg-[var(--eb-nude-a32)]" />
          </div>
          <div className="flex items-start gap-3 px-5 pb-2 pt-3">
            <div className="min-w-0 flex-1">
              {title ? <h2 className="text-xl font-medium tracking-[-0.01em]">{title}</h2> : null}
              {subtitle ? (
                <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{subtitle}</p>
              ) : null}
            </div>
            <IconButton icon="X" label="Fechar" size={44} onClick={onClose} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">{children}</div>
          {footer ? (
            <div className="flex gap-2.5 border-t border-[var(--border-hairline)] px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3.5">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}
