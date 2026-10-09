import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";

import { AuthCarousel } from "@/components/auth/auth-carousel";
import { ClientInviteForm } from "@/components/auth/client-invite-form";
import { FinishSignup } from "@/components/auth/finish-signup";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { LoginForm } from "@/components/auth/login-form";
import { SignupFlow } from "@/components/auth/signup-flow";
import { BrandMark } from "@/components/brand/brand-mark";
import { readInvite } from "@/lib/invite";
import { homeFor, sessionStore, useAuthState } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Acessar a EstetBoost." },
      {
        name: "description",
        content:
          "Entre na EstetBoost. e organize agenda, clientes e evolução do seu estúdio de estética.",
      },
      { property: "og:title", content: "Acessar a EstetBoost." },
      {
        property: "og:description",
        content:
          "Entre na EstetBoost. e organize agenda, clientes e evolução do seu estúdio de estética.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "entrar" | "criar" | "recuperar";

const tabs = [
  { value: "entrar", label: "Entrar" },
  { value: "criar", label: "Criar conta" },
] as const;

function AuthPage() {
  const navigate = useNavigate();
  const searchStr = useRouterState({ select: (state) => state.location.searchStr });
  const invite = readInvite(searchStr ?? "");
  const auth = useAuthState();
  const [mode, setMode] = useState<Mode>("entrar");
  const [notice, setNotice] = useState<string | null>(null);

  // Quem já tem sessão vai direto para a área do próprio perfil.
  useEffect(() => {
    if (auth.status === "in") navigate({ to: homeFor(auth.session.role) });
  }, [auth, navigate]);

  useEffect(() => {
    try {
      const text = window.sessionStorage.getItem("eb.notice");
      if (text) {
        setNotice(text);
        window.sessionStorage.removeItem("eb.notice");
      }
    } catch {
      /* ignorado */
    }
  }, []);

  const nothing = () => {};

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen grid-cols-1 min-[901px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <AuthCarousel />

        <div className="flex flex-col items-center justify-center gap-[22px] px-4 pb-10 pt-6 min-[901px]:px-10 min-[901px]:py-14">
          <div className="w-full max-w-[440px] text-2xl">
            <BrandMark />
          </div>

          <div
            className="w-full max-w-[440px] rounded-[28px] border border-[var(--glass-border)] bg-[var(--glass)] p-7 backdrop-blur-[22px] backdrop-saturate-[1.15]"
            style={{ boxShadow: "var(--glass-shadow), var(--glass-highlight)" }}
          >
            {notice ? (
              <p
                role="alert"
                className="mb-4 rounded-[var(--radius-md)] border border-[var(--border-card)] bg-[var(--eb-ivory-a06)] px-3.5 py-3 text-[13px] text-[var(--text-secondary)]"
              >
                {notice}
              </p>
            ) : null}
            {auth.status === "loading" || auth.status === "in" ? (
              <div className="min-h-[200px]" aria-busy />
            ) : auth.status === "error" ? (
              <div className="flex flex-col gap-3">
                <p className="text-[14px] text-[var(--text-secondary)]">{auth.message}</p>
                <button
                  type="button"
                  className="min-h-11 rounded-full border border-[var(--border-card)] px-4 text-sm"
                  onClick={() => void sessionStore.refresh()}
                >
                  Tentar de novo
                </button>
              </div>
            ) : auth.status === "needs-profile" ? (
              <FinishSignup email={auth.email} />
            ) : invite ? (
              <ClientInviteForm
                invite={invite}
                onSuccess={nothing}
                onLogin={() => navigate({ to: "/", search: {} })}
              />
            ) : mode === "recuperar" ? (
              <ForgotPasswordForm onBack={() => setMode("entrar")} />
            ) : (
              <>
                <div
                  role="tablist"
                  className="grid grid-cols-2 gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--eb-ivory-a06)] p-1"
                >
                  {tabs.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      onClick={() => setMode(tab.value)}
                      aria-selected={mode === tab.value}
                      className={cn(
                        "min-h-10 rounded-full px-3 text-sm transition-colors",
                        mode === tab.value
                          ? "bg-[var(--eb-ivory-a10)] font-medium text-foreground"
                          : "text-[var(--text-secondary)] hover:text-foreground",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {mode === "entrar" ? (
                  <LoginForm
                    onSuccess={nothing}
                    onForgot={() => setMode("recuperar")}
                    onCreate={() => setMode("criar")}
                  />
                ) : (
                  <SignupFlow onSuccess={nothing} onLogin={() => setMode("entrar")} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
