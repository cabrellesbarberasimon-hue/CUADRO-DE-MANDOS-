// Envío de emails con Resend (https://resend.com). Si no hay RESEND_API_KEY, no se envía nada
// (se registra en consola) y la app sigue funcionando.

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY);

export async function sendEmail(to: string[], subject: string, html: string): Promise<{ sent: boolean; error?: string }> {
  const recipients = Array.from(new Set(to.filter(Boolean)));
  if (!recipients.length) return { sent: false, error: "Sin destinatarios" };
  if (!emailEnabled()) {
    console.info(`[email desactivado] ${subject} → ${recipients.join(", ")}`);
    return { sent: false, error: "Email no configurado (RESEND_API_KEY)" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Cuadro de Mandos Bocubi <onboarding@resend.dev>",
      to: recipients,
      subject,
      html,
    }),
  });
  if (!res.ok) return { sent: false, error: `Resend ${res.status}: ${await res.text()}` };
  return { sent: true };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Plantilla HTML sencilla con estilo Bocubi. */
export function emailLayout(title: string, bodyHtml: string): string {
  const url = process.env.APP_URL || "";
  return `<!doctype html><html><body style="margin:0;background:#f4f2ee;font-family:Montserrat,Arial,sans-serif;color:#1a1a1a">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="font-size:26px;font-weight:300;letter-spacing:-0.5px;margin-bottom:16px">Bocubi</div>
    <div style="background:#fff;border:1px solid #e4e1db;border-radius:8px;padding:24px">
      <h1 style="font-size:18px;font-weight:500;margin:0 0 16px">${esc(title)}</h1>
      ${bodyHtml}
      ${url ? `<p style="margin-top:24px"><a href="${url}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px">Abrir cuadro de mandos</a></p>` : ""}
    </div>
    <p style="font-size:11px;color:#6b6b6b;margin-top:12px">Puedes desactivar estos avisos en Mi perfil.</p>
  </div></body></html>`;
}

export function emailTable(rows: [string, string, string][]): string {
  const colors: Record<string, string> = { Bien: "#3f7d58", Alerta: "#a87a17", Mal: "#b4432f" };
  return `<table style="width:100%;border-collapse:collapse;font-size:13px">${rows
    .map(
      ([a, b, c]) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #e4e1db">${esc(a)}</td><td style="padding:6px 0;border-bottom:1px solid #e4e1db;text-align:right">${esc(b)}</td><td style="padding:6px 0 6px 12px;border-bottom:1px solid #e4e1db;color:${colors[c] ?? "#6b6b6b"};font-weight:500">${esc(c)}</td></tr>`,
    )
    .join("")}</table>`;
}

export { esc };
