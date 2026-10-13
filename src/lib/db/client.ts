// Acceso a base de datos.
// - Producción: Postgres (Neon, Supabase, Vercel Postgres...) vía DATABASE_URL / POSTGRES_URL.
// - Local sin DATABASE_URL: Postgres embebido (PGlite) guardado en .data/pglite.
// - Tests: PGlite en memoria (DB_MEMORY=1).
// Las migraciones y la carga inicial se aplican solas la primera vez (ver migrations.ts).

import { MIGRATIONS } from "./migrations";
import { seedIfEmpty } from "./seed";
import { databaseUrl } from "@/lib/env";

type Driver = {
  query: <T>(text: string, params?: unknown[]) => Promise<T[]>;
  exec: (text: string) => Promise<void>;
};

type GlobalCache = { driver?: Promise<Driver>; ready?: Promise<void> };
const g = globalThis as unknown as { __bocubiDb?: GlobalCache };
const cache: GlobalCache = (g.__bocubiDb ??= {});

export { databaseUrl };

/** true si la app está en producción sin base de datos configurada. */
export function missingDatabase(): boolean {
  return !databaseUrl() && process.env.VERCEL === "1";
}

async function createDriver(): Promise<Driver> {
  const url = databaseUrl();
  if (url) {
    const { default: postgres } = await import("postgres");
    const local = /localhost|127\.0\.0\.1/.test(url);
    const sql = postgres(url, {
      max: 3,
      idle_timeout: 20,
      prepare: false,
      ssl: local ? false : "require",
      onnotice: () => {},
    });
    return {
      query: async <T>(text: string, params: unknown[] = []) =>
        (await sql.unsafe(text, params as never[])) as unknown as T[],
      exec: async (text: string) => {
        await sql.unsafe(text);
      },
    };
  }
  if (process.env.VERCEL === "1") throw new Error("Falta configurar DATABASE_URL");
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = process.env.DB_MEMORY === "1" ? undefined : (process.env.PGLITE_DIR ?? ".data/pglite");
  if (dataDir) (await import("fs")).mkdirSync(dataDir, { recursive: true });
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  await db.waitReady;
  return {
    query: async <T>(text: string, params: unknown[] = []) => (await db.query<T>(text, params)).rows,
    exec: async (text: string) => {
      await db.exec(text);
    },
  };
}

async function migrate(d: Driver) {
  await d.exec(`create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await d.query<{ id: string }>(`select id from schema_migrations`)).map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await d.exec(m.sql);
    await d.query(`insert into schema_migrations (id) values ($1) on conflict do nothing`, [m.id]);
  }
}

async function getDriver(): Promise<Driver> {
  cache.driver ??= createDriver().catch((e) => {
    cache.driver = undefined;
    throw e;
  });
  const d = await cache.driver;
  cache.ready ??= (async () => {
    try {
      await migrate(d);
    } catch {
      // Otra instancia puede estar migrando a la vez: reintenta una vez.
      await new Promise((r) => setTimeout(r, 500));
      await migrate(d);
    }
    await seedIfEmpty(d.query);
  })().catch((e) => {
    cache.ready = undefined;
    throw e;
  });
  await cache.ready;
  return d;
}

/** Ejecuta una consulta parametrizada ($1, $2...) y devuelve las filas. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const d = await getDriver();
  return d.query<T>(text, params);
}

export async function q1<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(text, params))[0] ?? null;
}

/** Solo para tests: reinicia la conexión en memoria. */
export function __resetForTests() {
  cache.driver = undefined;
  cache.ready = undefined;
}
