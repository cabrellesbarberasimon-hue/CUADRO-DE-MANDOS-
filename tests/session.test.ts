import { describe, expect, it } from "vitest";

describe("sesión sin AUTH_SECRET", () => {
  it("firma y verifica con la clave derivada de la base de datos", async () => {
    delete process.env.AUTH_SECRET;
    process.env.CUADRO_DATABASE_URL = "postgres://user:secreto@host/db";
    const { signSession, verifySession } = await import("@/lib/session");
    const token = await signSession(7);
    expect(await verifySession(token)).toBe(7);
    expect(await verifySession(token + "x")).toBeNull();
  });
});
