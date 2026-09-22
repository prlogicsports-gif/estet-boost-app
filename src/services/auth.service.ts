import type { SignupData } from "@/lib/auth.types";

const wait = () => new Promise((resolve) => setTimeout(resolve, 350));
export const authService = {
  async signIn() { await wait(); return { ok: true as const }; },
  async requestPasswordReset() { await wait(); return { ok: true as const }; },
  async signUp(_data: Partial<SignupData>) { await wait(); return { ok: true as const }; },
  async acceptInvite() { await wait(); return { ok: true as const }; },
};