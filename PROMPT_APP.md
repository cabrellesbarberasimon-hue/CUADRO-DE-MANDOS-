# Prompt para Claude Code — App "Cuadro de Mandos Bocubi"

> Copia todo lo que hay debajo de la línea y pégalo en Claude Code, dentro del repositorio `CUADRO-DE-MANDOS-`.
> Coloca antes el Excel original en `data/Cuadro_de_Mandos_Semanal_Ventas.xlsx` (se usa para la carga inicial de datos) y, si lo tienes, el logo en `public/logo-bocubi.svg` (o `.png`).

---

## 0. Contexto

Eres el desarrollador principal de **"Cuadro de Mandos Bocubi"**, la app interna de control de gestión de **Bocubi**, fabricante español de muebles a medida (salones, dormitorios, auxiliares; lema: *"No vendemos muebles, los fabricamos para ti"*). Sustituye a un Excel semanal de KPIs y tiene que estar al nivel de lo que usaría la dirección de una multinacional de fabricación de muebles. Puede ser sencilla de usar, pero no amateur.

**Usuarios iniciales:** Verónica (carga de datos y ventas), Borja (dirección), Mónica y Simón (administrador). El admin puede crear más usuarios.
**Uso:** en ordenador (escritorio). Responsive básico, sin prioridad en móvil.
**Idioma:** todo en español de España. Formato `1.234,56 €`, fechas `dd/mm/aaaa`, semanas ISO.

**Muy importante: la app se mejorará continuamente desde Claude Code.** El código tiene que ser fácil de modificar con peticiones cortas del tipo "cambia el objetivo de X", "añade el KPI Y" o "quita este gráfico". Ver sección 9.

Trabaja **por fases** (sección 10). Al final de cada fase, para, resume lo hecho y espera mi confirmación antes de seguir. Si algo no está claro, pregúntame antes de inventarlo.

---

## 1. Stack técnico

- **Next.js (App Router) + TypeScript estricto + Tailwind CSS + shadcn/ui.**
- **Supabase**: Postgres, Auth (email + contraseña, con invitación por email) y Row Level Security. Migraciones SQL versionadas en `supabase/migrations/`.
- **Gráficos:** Recharts.
- **Excel:** SheetJS (`xlsx`) para importar y exportar. **PDF:** `@react-pdf/renderer`.
- **Email:** Resend. **IA:** API de Claude (`@anthropic-ai/sdk`), con el modelo en una variable de entorno `ANTHROPIC_MODEL` (por defecto `claude-sonnet-5-5`).
- **Validación:** Zod. **Tests:** Vitest (lógica de KPIs) y Playwright (flujos críticos).
- **Repositorio:** GitHub. **Despliegue:** Vercel, conectado al repo. Cada rama o PR genera un *preview* y `main` es producción. Las tareas programadas se hacen con Vercel Cron.
- Todas las variables de entorno van documentadas en `.env.example`.

---

## 2. Identidad visual (corporativo Bocubi)

Basado en la web bocubi.com: minimalista, elegante, mucho blanco, tonos de madera de nogal y hormigón.

- **Logotipo:** la palabra "Bocubi" en sans-serif fina (light). Usa `public/logo-bocubi.*` si existe; si no, el texto en Montserrat 300.
- **Tipografía:** Montserrat (Google Fonts). Los menús llevan *letter-spacing* amplio (~0.08em). Los títulos van en peso medio, nunca en negrita pesada.
- **Paleta** (definida como tokens en `tailwind.config` / CSS variables):
  - Fondo `#FFFFFF`, fondo secundario hueso `#F4F2EE`
  - Texto principal `#1A1A1A`, texto secundario `#6B6B6B`
  - Acento nogal `#6B4A32` y nogal claro `#A07855`
  - Gris hormigón `#8E8C87`, bordes `#E4E1DB`
  - Semáforo en tonos sobrios (no chillones): Bien `#3F7D58`, Alerta `#C9962B`, Mal `#B4432F`, Sin dato `#B8B5AF`
- **Componentes:** botón principal negro relleno, botón secundario con contorno negro de 1px (como el botón "Dónde comprar" de la web), botones de acción con forma de píldora. Tarjetas planas con borde fino y sombras mínimas.
- **Estructura:** cabecera blanca con el logo a la izquierda y el menú horizontal; barra lateral opcional en las secciones de detalle. Modo claro por defecto; el modo oscuro es opcional.

---

## 3. Modelo de datos

### 3.1 Tablas (Supabase)

- `profiles`: id (= auth.users), nombre, email, rol, área, activo.
- **Roles:**
  - `admin`: todo, incluida la gestión de usuarios y la configuración.
  - `direccion`: ve todo, comenta, crea y cierra acciones.
  - `editor`: carga e importa datos y edita semanas.
  - `lector`: solo lectura.
- `weekly_data`: **una fila por año + semana ISO** (clave única `year, week`). Solo guarda **datos de entrada**. Los campos calculados **nunca** se almacenan; se calculan en código (corrección del punto 7).
  Campos:
  - Fechas: `start_date`, `end_date`, `is_closed` (semana sin actividad: vacaciones, cierre).
  - Pedidos y ventas: `orders_count`, `sales_eur`, `sales_prev_year_eur`.
  - Presupuestos: `quotes_sent`, `quotes_confirmed`, `quotes_confirmed_eur`.
  - Pedidos servidos: `served_eur`, `served_count`, `late_orders_count`, `late_orders_eur`.
  - Incidencias: `incidents_count`, `incidents_late_count`.
  - Cartera pendiente: `pending_orders_count`, `pending_orders_eur`.
  - Marketing y leads: `leads_generated`, `cpl_eur`, `landing_conversion_pct`, `leads_to_sale`, `leads_contacted`, `leads_contacted_24h` (nuevo, opcional), `leads_reassigned`.
  - Seguimiento: `owner`, `comment`, `weekly_action`, `data_source` ('manual' | 'import' | 'seed'), `updated_by`, `updated_at`.
  - Todos los numéricos son *nullable*: **null = sin dato, distinto de 0**.
- `targets`: objetivos por KPI, con vigencia (`kpi_key`, `value`, `valid_from_year`, `valid_from_week`, `valid_to_*` opcional) y posibilidad de **objetivo específico por semana o mes** (estacionalidad).
- `settings`: capacidad semanal de fábrica (por defecto 45.000 €), umbrales globales, emails de alertas, etc.
- `kpi_comments`: comentario por KPI y semana (autor, fecha).
- `actions`: plan de acción. Campos: título, descripción, `kpi_key`, semana de origen, responsable, fecha límite, prioridad, estado (`pendiente` | `en curso` | `hecha` | `descartada`), fecha de cierre, resultado.
- `meetings`: actas de la reunión semanal (semana, asistentes, foco semanal, notas, acciones vinculadas).
- `imports`: histórico de importaciones (archivo, usuario, fecha, filas creadas/actualizadas/rechazadas, log de errores). El archivo se guarda en Supabase Storage.
- `audit_log`: quién cambió qué campo, valor anterior y nuevo, y cuándo.

RLS activado en todas las tablas según rol.

### 3.2 KPIs calculados (en `src/lib/kpis/`)

Todos se calculan con funciones puras y testeadas. **Si falta el divisor o algún dato, el resultado es `null` ("sin dato"), nunca 0 ni error.**

| KPI | Fórmula |
|---|---|
| Ticket medio venta | `sales_eur / orders_count` |
| % vs objetivo ventas | `sales_eur / objetivo_ventas` |
| % vs año anterior | `sales_eur / sales_prev_year_eur − 1` |
| % presupuestos confirmados (nº) | `quotes_confirmed / quotes_sent` |
| Importe medio presupuesto confirmado | `quotes_confirmed_eur / quotes_confirmed` |
| % fuera de plazo | `late_orders_count / served_count` (**corregido**, ver 4.4) |
| % incidencias | `incidents_count / orders_count` |
| % incidencias fuera de plazo | `incidents_late_count / incidents_count` |
| Valor medio pedido pendiente | `pending_orders_eur / pending_orders_count` |
| Carga de fábrica (semanas) | `pending_orders_eur / capacidad_semanal` |
| % conversión lead→venta | `leads_to_sale / leads_generated` |
| % leads contactados | `leads_contacted / leads_generated` |
| % leads contactados < 24 h | `leads_contacted_24h / leads_generated` |
| Leads sin trabajar | `leads_generated − leads_contacted` |
| Inversión marketing estimada | `leads_generated × cpl_eur` |
| CAC (coste por venta) | `inversión / leads_to_sale` |
| Book-to-bill | `sales_eur / served_eur` (entrada de pedidos frente a lo servido; si es > 1, la cartera crece) |

**Agregados** (mes, trimestre, año, YTD): las sumas se suman, y **los porcentajes se recalculan a partir de los totales** (por ejemplo, % incidencias del mes = Σ incidencias / Σ pedidos). Nunca se hace la media de los porcentajes. Los KPIs de *stock* (cartera pendiente, carga de fábrica) usan el **último valor del periodo**. Pedidos atrasados (€) del mes = **suma**, y además se muestra el máximo semanal.

### 3.3 Semáforo

Una única función configurable por KPI, con dirección `higher_is_better`, `lower_is_better` o `range`:

- **Mayor es mejor:** Bien si `≥ objetivo`, Alerta si `≥ 85 %` del objetivo, Mal por debajo.
- **Menor es mejor:** Bien si `≤ objetivo`, Alerta si `≤ 120 %` del objetivo, Mal por encima.
- **Rango (carga de fábrica):** Bien entre 4 y 5 semanas, Alerta entre 3 y 4 o entre 5 y 6, Mal fuera de esos rangos.
- **Sin dato o semana cerrada:** gris, "Sin dato" o "Cerrada". No penaliza.

Los porcentajes 85 % y 120 % son editables por KPI desde Configuración.

### 3.4 Objetivos iniciales (editables desde la app)

| KPI | Objetivo | Dirección |
|---|---|---|
| Ventas semanales | 46.500 € | mayor |
| % vs objetivo | 100 % | mayor |
| Pedidos servidos (€) | 43.000 € | mayor |
| Leads generados | 75 | mayor |
| % conversión lead→venta | 10 % | mayor |
| % leads contactados | 80 % | mayor |
| Leads sin trabajar | 10 | menor |
| % fuera de plazo | 10 % | menor |
| % incidencias | 5 % | menor |
| Pedidos atrasados (€) | 5.000 € *(pendiente de confirmar)* | menor |
| Carga de fábrica | 4–5 semanas | rango |
| Capacidad semanal fábrica | 45.000 € | (parámetro) |

---

## 4. Correcciones obligatorias respecto al Excel original

1. **"Pedidos servidos" del dashboard** mostraba por error el % de incidencias (VLOOKUP a la columna equivocada). Debe mostrar `served_eur`.
2. **Objetivo de ventas:** había dos valores (46.000 en el dashboard y 46.500 en los datos). Pasa a haber **una única fuente de verdad** en `targets` (46.500 €).
3. **Objetivo de pedidos atrasados** era "5", que con importes en euros siempre da "Mal". Se cambia a 5.000 € y se marca como "pendiente de confirmar" en Configuración.
4. **% fuera de plazo** se calculaba sobre los pedidos *pendientes*. Ahora se calcula sobre los **pedidos servidos** de la semana.
5. Había **dos columnas "Ticket medio"** con significados distintos. Se renombran a **"Ticket medio venta"** y **"Valor medio pedido pendiente"**.
6. **"Ventas 2024"** pasa a ser **"Ventas año anterior"**. Si la app tiene datos de la misma semana del año anterior, se usan automáticamente; si no, se usa el valor introducido o importado. Siempre se guardan como número (en el Excel había fórmulas como `=176295/4` o `=29-2`).
7. **Gráficos rotos (#REF!) y fórmulas sustituidas por espacios:** todos los cálculos se hacen en código, así que esto no puede volver a pasar.
8. **El mes se escribía a mano**, y las semanas que caen entre dos meses descuadraban el resumen. Ahora el mes se **deriva automáticamente** de la semana ISO (el mes al que pertenece el jueves de esa semana, que es la convención ISO). Se puede cambiar en un único sitio (`src/lib/calendar.ts`).
9. **Agosto con ceros:** se añade el flag `is_closed` (semana cerrada o vacaciones). Esas semanas se excluyen del semáforo, de las medias y de los objetivos, y aparecen sombreadas en los gráficos.
10. **Datos vacíos:** se muestra "Sin dato" en lugar de 0. Cada semana tiene un **indicador de completitud** (% de campos rellenados por área), con aviso si una semana pasada está incompleta.

---

## 5. Funcionalidades

### 5.1 Acceso y usuarios
- Login con email y contraseña, y recuperación de contraseña.
- **Panel de usuarios (solo admin):** crear usuario o enviar invitación por email, asignar rol y área, desactivar y reactivar.
- Usuarios iniciales en el seed: Simón (admin), Borja (dirección), Mónica (dirección), Verónica (editor). Los emails reales se configuran en `.env` o en el seed; **pregúntame por ellos**.

### 5.2 Inicio: Dashboard ejecutivo
- Selector de **año + semana** (por defecto, la última semana con datos) y botones ← →.
- **Tarjetas KPI** con:
  - valor;
  - objetivo;
  - semáforo;
  - comparación con la semana anterior (Δ y flecha);
  - comparación con la misma semana del año anterior;
  - *sparkline* de las últimas 12 semanas.
- **Bloque "Acumulado año (YTD)":** ventas acumuladas frente al objetivo acumulado y frente al año anterior, con el % de cumplimiento.
- **Previsión de cierre de año:** proyección por ritmo medio de las últimas 8 semanas abiertas y proyección estacional según el año anterior, si hay datos.
- **"Foco semanal":** KPI prioritario, problema principal, acción concreta, responsable y fecha de revisión (como en el Excel, pero guardado y con histórico).
- **Banner de alertas:** KPIs en rojo sin comentario o acción, acciones vencidas, semana anterior sin datos.

### 5.3 Vistas por área (cada una con su página)
- **Comercial / Ventas:**
  - ventas semanales frente a objetivo y año anterior (barras + línea);
  - nº pedidos y ticket medio;
  - book-to-bill;
  - acumulado YTD.
- **Presupuestos (pipeline):**
  - enviados → confirmados (nº y €);
  - tasa de cierre;
  - importe medio;
  - tendencia.
- **Marketing y Leads:**
  - embudo leads → contactados → ventas;
  - CPL, CAC, inversión estimada y % conversión de la landing;
  - leads sin trabajar y reasignados.
- **Operaciones / Producción:**
  - pedidos servidos (€ y nº);
  - % fuera de plazo y pedidos atrasados (€);
  - cartera pendiente (€ y nº);
  - **carga de fábrica** en semanas, con banda objetivo de 4 a 5 sombreada;
  - capacidad frente a carga.
- **Calidad:**
  - % incidencias y % incidencias fuera de plazo;
  - tendencia;
  - Pareto, preparado para cuando haya causas.

Cada gráfico permite elegir el rango (últimas 13 semanas, trimestre, año, personalizado) y comparar con el año anterior.

### 5.4 Resumen mensual / trimestral / anual
- Tabla por mes con ventas, objetivo, % vs objetivo, año anterior, % vs año anterior, leads, % conversión, % incidencias, % fuera de plazo y pedidos atrasados, cada uno con su semáforo.
- Pestañas para mes, trimestre y año. Columna de comentario mensual editable por dirección.
- Exportable a Excel y PDF.

### 5.5 Datos semanales
- Tabla editable de todas las semanas del año (editor/admin), con:
  - columnas agrupadas por área;
  - campos calculados en solo lectura con otro fondo;
  - validación de rangos (sin negativos; % entre 0 y 100);
  - indicador de completitud por fila.
- Formulario de "Cargar semana" paso a paso por áreas, como alternativa a la tabla.
- Cada cambio queda en `audit_log`. Historial visible por semana.

### 5.6 Plan de acción (regla clave del Excel)
> "Si un KPI está en Mal o Alerta, debe haber comentario y acción concreta. Dato → decisión."

- **La app obliga a cumplirlo:** un KPI en Alerta o Mal queda marcado como "pendiente de análisis" hasta que tenga comentario y al menos una acción vinculada. Aparece en el banner del dashboard.
- **Gestor de acciones:** lista y tablero Kanban (pendiente / en curso / hecha), con filtros por responsable, KPI, estado y vencimiento.
- Al cerrar una acción se registra el resultado. Se calcula el **% de acciones cerradas en plazo** como KPI de gestión.

### 5.7 Reunión semanal
- **Modo reunión** a pantalla completa (como la "Plantilla Semana" del Excel), recorriendo las áreas en orden. Cada KPI muestra valor, objetivo, responsable, comentario y acción, con estos responsables por defecto (editables en Configuración):
  - Ventas: Verónica.
  - Marketing: Rafa.
  - Sistema de leads: Verónica / Sheila.
  - Producción y calidad: Manolo / Juan.
- Durante la reunión se pueden escribir comentarios y crear acciones.
- Al terminar, se genera el **acta en PDF** (KPIs + semáforos + foco + acciones) y opcionalmente se envía por email a los asistentes.

### 5.8 Alertas y notificaciones (Resend + Vercel Cron)
- **Lunes a las 9:00 (Europe/Madrid):** email de resumen semanal a dirección con KPIs, semáforos y acciones vencidas.
- **Lunes a las 12:00:** recordatorio al editor si la semana anterior no tiene datos o está por debajo del 80 % de completitud.
- **Al guardar o importar una semana:** email si algún KPI pasa a "Mal".
- Avisos de acciones que vencen en 2 días o ya vencidas.
- Cada usuario puede activar o desactivar cada tipo de aviso.

### 5.9 Análisis con IA (Claude)
- Botón **"Generar resumen ejecutivo"** en el dashboard y en el acta. Envía a Claude los KPIs de la semana, la tendencia de 8 semanas y las acciones abiertas, y devuelve 5–8 líneas en español:
  - qué va bien;
  - qué va mal;
  - posibles causas;
  - acciones sugeridas.
- El resultado se guarda y puede editarse antes de usarlo.
- La API key solo se usa en el servidor, nunca en el cliente. Si no hay key configurada, la función se oculta.

### 5.10 Exportaciones
- Excel: datos semanales completos y resumen mensual.
- PDF: dashboard de la semana, resumen mensual y acta de reunión, con el estilo Bocubi.

### 5.11 Configuración (admin)
- Objetivos por KPI con vigencia y objetivos por mes o semana (estacionalidad).
- Umbrales del semáforo, capacidad semanal de fábrica, responsables por área, semanas cerradas y destinatarios de alertas.

### 5.12 Importación de Excel ⚠️ PENDIENTE DE DEFINIR
- Todavía **no sé el formato exacto del archivo** que se importará cada semana. **No implementes el mapeo definitivo.** Deja preparada la arquitectura:
  - página "Importar" con subida de .xlsx/.csv;
  - previsualización;
  - validación con Zod;
  - informe de filas nuevas, actualizadas y con error;
  - confirmación;
  - *upsert* por `year + week`;
  - registro en `imports`.
- El **mapeo de columnas** va en un único archivo `src/lib/import/mappings/` (un mapeo por tipo de archivo), para que yo pueda añadir el definitivo más adelante con una petición corta.
- **Ahora sí:** implementa un mapeo `excel-original.ts` que lea la hoja "Datos Semanales" del Excel original (cabecera en la fila 4, datos desde la fila 5) y úsalo para la **carga inicial (seed)** de las semanas 17–41 de 2026 desde `data/Cuadro_de_Mandos_Semanal_Ventas.xlsx`:
  - las celdas con fórmula (como `=29-2`) se evalúan a número;
  - las semanas 32–34 de agosto con ceros se cargan como `is_closed = true`.

---

## 6. Estructura del proyecto

```
src/
  app/                 # rutas: (auth)/login, dashboard, ventas, presupuestos, marketing,
                       # operaciones, calidad, resumen, datos, acciones, reunion,
                       # importar, configuracion, usuarios
  components/          # ui (shadcn), charts, kpi-card, traffic-light, week-picker...
  config/
    kpis.ts            # ★ DEFINICIÓN DE TODOS LOS KPIs (clave, nombre, área, unidad,
                       #   fórmula, dirección del semáforo, formato, responsable)
    areas.ts           # áreas, orden y responsables por defecto
    theme.ts           # tokens de marca
  lib/
    kpis/              # cálculo, agregación y semáforo (funciones puras + tests)
    calendar.ts        # semanas ISO, mes de cada semana, festivos
    import/            # motor de importación + mappings/
    export/            # excel y pdf
    ai/                # resumen con Claude
    supabase/          # clientes server/browser y tipos generados
supabase/migrations/   # SQL versionado
supabase/seed.ts       # usuarios iniciales + carga del Excel original
data/                  # Excel original
tests/                 # vitest + playwright
```

**Principio clave:** añadir, quitar o cambiar un KPI se hace **solo en `src/config/kpis.ts`** (y en la migración, si necesita un campo de entrada nuevo). Dashboard, semáforo, resúmenes, exportaciones y reunión se generan a partir de esa configuración.

---

## 7. Calidad

- **Tests de Vitest** de todas las fórmulas, agregaciones y del semáforo, incluyendo casos con nulos, divisor 0 y semanas cerradas.
- **Test "golden"** que compara los cálculos de la app con los valores del Excel original en varias semanas reales (por ejemplo, la 20, la 25 y la 30), aplicando las correcciones de la sección 4.
- `npm run lint`, `npm run typecheck` y `npm test` tienen que pasar antes de cada commit.
- GitHub Actions ejecuta lint, typecheck y tests en cada PR.
- Accesibilidad básica: contraste correcto, el semáforo lleva texto además de color, navegación por teclado.

---

## 8. Despliegue

- Repositorio GitHub `CUADRO-DE-MANDOS-` conectado a Vercel. Supabase integrado (Vercel Marketplace o proyecto propio).
- Documenta en `README.md` paso a paso, para alguien no técnico:
  1. Crear el proyecto en Supabase y aplicar las migraciones.
  2. Configurar las variables de entorno en Vercel (Supabase, Resend, Anthropic).
  3. Ejecutar el seed.
  4. Crear el primer admin.
  5. Configurar el dominio (opcional, por ejemplo `kpi.bocubi.com`).
- Crons definidos en `vercel.json`, en zona horaria Europe/Madrid.

---

## 9. Mantenimiento continuo con Claude Code (imprescindible)

Quiero ir pidiéndote cambios sobre la marcha. Para eso:

1. **Crea un `CLAUDE.md`** en la raíz con:
   - arquitectura resumida;
   - dónde se cambia cada cosa (KPIs → `src/config/kpis.ts`, objetivos → Configuración en la app o seed, colores → `src/config/theme.ts`, importación → `src/lib/import/mappings/`);
   - comandos (`dev`, `test`, `lint`, `typecheck`, `db:migrate`, `db:seed`, `db:types`);
   - convenciones de código;
   - la regla de que **todo cambio de base de datos va en una migración nueva**, nunca editando una existente.
2. **Flujo de trabajo:**
   - cada petición se hace en una rama;
   - se comprueba que pasan los tests;
   - push → Vercel genera un *preview* que reviso;
   - merge a `main` → producción.
   - Dime siempre la URL del preview cuando la haya.
3. **Código simple y legible.** Nada de abstracciones innecesarias. Comentarios en español solo donde aporten.
4. **`CHANGELOG.md`** actualizado en cada cambio, con lenguaje de negocio (qué ha cambiado para el usuario).
5. **Página "Novedades"** dentro de la app que lea el CHANGELOG.

---

## 10. Plan por fases (para al final de cada una)

1. **Fase 1 — Base:** proyecto, tema Bocubi, Supabase, migraciones, auth, roles, gestión de usuarios, `config/kpis.ts`, motor de cálculo y semáforo con tests, seed con el Excel original, CLAUDE.md, README y despliegue en Vercel.
2. **Fase 2 — Visualización:** dashboard ejecutivo, vistas por área, resumen mensual/trimestral/anual y datos semanales editables con auditoría.
3. **Fase 3 — Gestión:** plan de acción, regla "Mal/Alerta → comentario + acción", foco semanal, modo reunión y acta PDF, configuración de objetivos.
4. **Fase 4 — Automatización:** alertas por email, crons, resumen con IA, exportaciones Excel/PDF y página de novedades.
5. **Fase 5 — Importación definitiva:** cuando te pase el archivo real, crear su mapeo y probarlo.

Empieza por la Fase 1. Antes de escribir código, muéstrame un resumen de lo que vas a hacer y hazme las preguntas que necesites (emails de los usuarios, si ya existe un proyecto Supabase, si tengo logo en SVG, etc.).
