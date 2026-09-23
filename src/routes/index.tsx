import { useState } from "react";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";

import { AuthCarousel } from "@/components/auth/auth-carousel";
import { ClientInviteForm } from "@/components/auth/client-invite-form";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { LoginForm } from "@/components/auth/login-form";
import { SignupFlow } from "@/components/auth/signup-flow";
import { BrandMark } from "@/components/brand/brand-mark";
import { SplashScreen } from "@/components/splash/splash-screen";
import { readInvite } from "@/lib/invite";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Acessar a EstetBoost." },
      {
        name: "description",
        content: "Entre na EstetBoost. e organize agenda, clientes e evolução do seu estúdio de estética.",
      },
      { property: "og:title", content: "Acessar a EstetBoost." },
      {
        property: "og:description",
        content: "Entre na EstetBoost. e organize agenda, clientes e evolução do seu estúdio de estética.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "entrar" | "criar" | "recuperar";

function AuthPage() {
  const navigate = useNavigate();
  const searchStr = useRouterState({ select: (state) => state.location.searchStr });
  const invite = readInvite(searchStr ?? "");
  const [splash, setSplash] = useState(true);
  const [mode, setMode] = useState<Mode>("entrar");

  const goToApp = () => navigate({ to: "/hoje" });

  return (
    <div className="min-h-screen bg-background">
      {splash ? <SplashScreen onDone={() => setSplash(false)} /> : null}

      <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
        <div className="relative hidden lg:block">
          <AuthCarousel />
        </div>

        <div className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-[440px] rounded-[var(--radius-xl)] p-6 glass-panel sm:p-8">
            <div className="mb-6 text-xl">
              <BrandMark />
            </div>

            {invite ? (
              <ClientInviteForm invite={invite} onSuccess={goToApp} />
            ) : mode === "recuperar" ? (
              <ForgotPasswordForm onBack={() => setMode("entrar")} />
            ) : (
              <>
                <div className="mb-6 grid grid-cols-2 gap-1 rounded-[var(--radius-md)] bg-[var(--muted)] p-1">
                  {(
                    [
                      { value: "entrar", label: "Entrar" },
                      { value: "criar", label: "Criar conta" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setMode(tab.value)}
                      aria-pressed={mode === tab.value}
                      className={cn(
                        "min-h-11 rounded-[var(--radius-sm)] text-sm transition-colors",
                        mode === tab.value
                          ? "bg-[var(--accent)] text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {mode === "entrar" ? (
                  <LoginForm
                    onSuccess={goToApp}
                    onForgot={() => setMode("recuperar")}
                    onCreate={() => setMode("criar")}
                  />
                ) : (
                  <SignupFlow onSuccess={goToApp} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
