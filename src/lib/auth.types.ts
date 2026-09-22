export type StudioSize = "autonoma" | "clinica";
export type Invite = { slug: string | null; code: string | null; professional: string };
export type SignupData = { name: string; email: string; phone: string; studio: string; city: string; size: StudioSize };