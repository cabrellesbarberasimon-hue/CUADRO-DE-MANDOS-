# Cuadro de Mandos Bocubi — guía para Claude Code

App interna de control de gestión semanal de **Bocubi** (fabricante de muebles a medida). Sustituye al Excel
`data/Cuadro_de_Mandos_Semanal_Ventas.xlsx`. Usuarios: Verónica (datos), Borja, Mónica y Simón (admin).
Todo el texto de la interfaz va en **español de España** (formato `1.234,56 €`, `dd/mm/aaaa`, semanas ISO).

## Stack

Next.js 15 (App Router, Server Components + Server Actions) · TypeScript estricto · Tailwind CSS 4 ·
Postgres (`postgres`; en local sin `DATABASE_URL` se usa PGlite en `.data/`) · Recharts · ExcelJS ·
Auth propia (bcrypt + JWT en cookie) · Resend (emails) · Anthropic SDK (resumen IA) · Vitest · Vercel.

## Dónde se cambia cada cosa

| Quiero cambiar… | Archivo |
|---|---|
| Un KPI (añadir, quitar, fórmula, dirección del semáforo, objetivo inicial, si sale en el dashboard) | `src/config/kpis.ts` |
| Un dato de entrada semanal (campo que se rellena/importa) | `src/config/fields.ts` **+ migración nueva** en `src/lib/db/migrations.ts` + `seed`/mapeos si aplica |
| Áreas y responsables por defecto | `src/config/areas.ts` (los responsables reales se editan en la app → Configuración) |
| Objetivos vigentes | En la app → Configuración (tabla `targets`). Los de `kpis.ts` son solo el valor inicial |
| Colores de marca / gráficos | `src/app/globals.css` (`@theme`) y `src/config/theme.ts` |
| Importar un Excel nuevo | `src/lib/import/mappings/` (copiar `excel-original.ts`, añadir a `index.ts`) |
| Columnas del resumen mensual | `SUMMARY_KPIS` en `src/config/kpis.ts` |
| Lógica de cálculo, agregados, semáforo | `src/lib/kpis/engine.ts` (funciones puras, con tests) |
| Semanas ISO / mes de cada semana | `src/lib/calendar.ts` |
| Emails y tareas programadas | `src/lib/notify.ts`, `src/lib/email.ts`, `vercel.json`, `src/app/api/cron/*` |
| Prompt del resumen IA | `src/lib/ai.ts` |
| Novedades visibles en la app | `src/config/changelog.ts` (**añade una entrada en cada cambio**, en lenguaje de negocio) |

Páginas en `src/app/(app)/…` (con cabecera y login), impresión/PDF en `src/app/imprimir/…`,
acciones de servidor en `src/app/actions/*`.

## Reglas del dominio (no romper)

- Si falta un dato o el divisor es 0 → `null` = "Sin dato". Nunca 0 ni error.
- Los datos de entrada se guardan; los calculados **nunca** (se calculan en `engine.ts`).
- Agregados: sumas se suman; % se recalculan con totales; stock (cartera pendiente) = último valor; semanas cerradas excluidas.
- Objetivo de KPIs `additive` en periodos = suma de objetivos semanales de las semanas reportadas.
- % vs año anterior: solo semanas con dato en ambos años (`sales_matched_eur`).
- Mes de una semana = mes de su jueves (ISO).
- Regla clave: KPI del dashboard en Alerta/Mal ⇒ necesita comentario + acción (`pendingAnalysis`).
- Porcentajes guardados como fracción (0,25). En formularios se escriben como 25.

## Base de datos

- **Nunca edites una migración existente**: añade una nueva al final de `MIGRATIONS` con id nuevo (`003_…`).
- Las migraciones y la carga inicial (`src/data/seed-2026.json`) se aplican solas en el primer acceso.
- Consultas con `q()` / `q1()` y parámetros `$1, $2…` (nunca concatenar valores del usuario).

## Comandos

```bash
npm run dev        # http://localhost:3000 (crea .data/pglite; el primer acceso lleva a /setup)
npm test           # vitest: fórmulas, semáforo, golden vs Excel, importación
npm run lint
npm run typecheck
npm run build
```

Antes de cada commit: `npm run lint && npm run typecheck && npm test`.

## Flujo de trabajo

1. Cada cambio en una rama → push → Vercel genera un *preview* (dar la URL al usuario).
2. Revisado → merge a la rama de producción → despliegue automático.
3. Actualiza `src/config/changelog.ts`.
4. Código simple y legible; comentarios en español solo donde aporten.
