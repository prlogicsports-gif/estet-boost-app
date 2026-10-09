// Banco de teste sem Docker: Postgres real (PGlite) + simulação mínima do schema "auth" do Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export async function createDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  const dir = join(here, "..", "migrations");
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    try {
      await db.exec(readFileSync(join(dir, file), "utf8"));
    } catch (error) {
      throw new Error(`Migração ${file} falhou: ${error.message}`);
    }
  }
  return db;
}

export async function addUser(db, email, confirmed = true) {
  const r = await db.query(
    "insert into auth.users (email, email_confirmed_at) values ($1, $2) returning id",
    [email, confirmed ? new Date() : null],
  );
  return r.rows[0].id;
}

/** Executa como um usuário logado (papel authenticated) ou anônimo (uid = null). */
export async function as(db, uid, fn) {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
