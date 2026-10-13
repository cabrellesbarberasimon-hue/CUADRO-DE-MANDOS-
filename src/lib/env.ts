// Lectura de variables de entorno sin dependencias (se usa también en el middleware).

/**
 * URL de Postgres. Al conectar Neon desde Vercel, las variables pueden llevar un prefijo elegido
 * al conectar (p. ej. CUADRO_DATABASE_URL o STORAGE_POSTGRES_URL), así que se aceptan todas.
 */
export function databaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  const keys = Object.keys(process.env).sort();
  const key =
    keys.find((k) => /(^|_)DATABASE_URL$/.test(k) && process.env[k]) ??
    keys.find((k) => /(^|_)POSTGRES_URL$/.test(k) && process.env[k]);
  return key ? process.env[key] : undefined;
}
