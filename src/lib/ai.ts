// Resumen ejecutivo semanal con Claude. Solo se ejecuta en el servidor.
// Si no hay ANTHROPIC_API_KEY configurada, la función se oculta en la interfaz.

import Anthropic from "@anthropic-ai/sdk";
import { fmt } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/kpis/engine";
import type { KpiWeekView } from "@/lib/views";
import type { Action } from "@/lib/data";

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const SYSTEM = `Eres el analista de control de gestión de Bocubi, fabricante español de muebles a medida (salones, dormitorios, auxiliares).
Recibes los KPIs semanales de la empresa y escribes un resumen ejecutivo para la reunión de dirección del lunes.
Escribe en español de España, en 5 a 8 viñetas breves y concretas, con este orden:
1. Qué va bien (con cifras).
2. Qué va mal o en alerta (con cifras y comparación con objetivo / semana anterior / año anterior).
3. Posibles causas (si los datos lo permiten; si no, dilo).
4. Acciones sugeridas, concretas y con responsable cuando sea evidente.
No inventes datos que no aparezcan. Si faltan datos importantes, menciónalo en una viñeta.
Devuelve solo las viñetas, cada una empezando por "• ", sin títulos ni introducción.`;

export async function generateWeeklySummary(input: {
  year: number;
  week: number;
  views: KpiWeekView[];
  openActions: Action[];
  comment?: string | null;
}): Promise<string> {
  const client = new Anthropic();
  const kpiLines = input.views
    .map((v) => {
      const trend = v.spark.slice(-8).map((s) => (s.value == null ? "—" : fmt(s.value, v.def.unit))).join(" · ");
      return `- ${v.def.label}: ${fmt(v.value, v.def.unit)} | objetivo ${v.def.direction === "none" ? "—" : fmt(v.target.value, v.def.unit)} | estado ${STATUS_LABEL[v.status]} | semana anterior ${fmt(v.prevWeekValue, v.def.unit)} | año anterior ${fmt(v.prevYearValue, v.def.unit)} | últimas 8 semanas: ${trend}`;
    })
    .join("\n");
  const actions = input.openActions.length
    ? input.openActions.map((a) => `- [${a.status}] ${a.title} (resp.: ${a.owner ?? "—"}, vence ${a.due_date ?? "—"})`).join("\n")
    : "- Ninguna";
  const prompt = `Semana ${input.week} de ${input.year}.

KPIs:
${kpiLines}

Acciones abiertas:
${actions}

Comentario del responsable de datos: ${input.comment || "—"}`;

  const response = await client.beta.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: prompt }],
  } as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") throw new Error("El modelo no ha podido generar el resumen.");
  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  if (!text) throw new Error("Respuesta vacía del modelo.");
  return text;
}
