# Prompt: módulo de Facturación y Contabilidad (sustituto de Contasimple)

> **Estado: BORRADOR.** Faltan las capturas marcadas como `[PENDIENTE]`. Cuando estén, se completa
> y se pega en Claude Code fase a fase (una fase = una rama = un preview de Vercel).

---

## Contexto

Estás trabajando en la app interna de Bocubi (cuadro de mandos semanal). Lee primero `CLAUDE.md` y
respeta su stack, sus convenciones y sus reglas: Next.js 15 App Router, Server Actions, Postgres con
`q()`/`q1()`, migraciones nuevas al final de `MIGRATIONS` (nunca editar las existentes), español de
España, entrada en `src/config/changelog.ts` en cada cambio, y `npm run lint && npm run typecheck && npm test`
antes de cada commit.

Vamos a añadir **dentro de esta misma app** un módulo de facturación y contabilidad que sustituya a
Contasimple. Se comparten el login, los usuarios y la base de datos. Las ventas facturadas deben poder
alimentar los KPIs del cuadro de mandos.

## Navegación

El módulo tiene su propio **panel lateral** (rutas bajo `src/app/(app)/gestion/…`), con un botón
destacado **"+ Crear"** arriba (menú rápido: factura, presupuesto, factura recibida, gasto, cliente,
proveedor, producto, movimiento de banco). Menú, en este orden:

| Sección | Subapartados |
|---|---|
| **Inicio** | Panel: ventas, gastos y resultado del trimestre/año, cobros y pagos pendientes, vencidos, saldo de bancos, próximos impuestos |
| **Ventas** | `[PENDIENTE captura]`. Previsto: Facturas emitidas, Presupuestos, Albaranes, Facturas proforma, Facturas recurrentes, Exportar, Importar |
| **Compras** | Facturas recibidas · Bienes de inversión · Gastos · OCR · Importar factura · Exportar · Importar · Cierre de trimestres |
| **Contactos** | Clientes · Proveedores · Importar |
| **Catálogo** | `[PENDIENTE captura]`. Previsto: Productos y servicios, Categorías, Tarifas |
| **Bancos / Caja** | Resumen · Movimientos · Conciliación · Cobros y pagos · Recibos y remesas (submenú `[PENDIENTE]`) |
| **Impuestos** | Resumen · Calendario fiscal · IVA (303, 390) · IRPF (130, 100) · Retenciones (111, 190) · Ret. alquileres (115, 180) · Op. terceras personas (347) · `[PENDIENTE: resto de la lista]` |
| **Disco virtual** | Archivos y carpetas (adjuntos de facturas, tickets, documentos) |
| **Informes** | `[PENDIENTE captura]`. Previsto: Pérdidas y ganancias, Balance, Libro diario, Libro mayor, Sumas y saldos, Libros registro de IVA, Ventas por cliente/producto |

En el móvil, el panel lateral se convierte en un menú desplegable.

## Funciones por sección

### Contactos
- Clientes y proveedores: razón social, nombre comercial, NIF/CIF (con validación), dirección, país,
  email, teléfono, forma de pago y vencimiento por defecto, IBAN, tipo de IVA o exención por defecto,
  recargo de equivalencia, retención IRPF, cuenta contable (430xxxx / 400xxxx, generada sola) y notas.
- Importar desde Excel o CSV, reutilizando el asistente de importación existente.

### Catálogo
- Productos y servicios: referencia, descripción, precio de venta, coste, tipo de IVA, categoría y
  cuenta de ventas (70x).

### Ventas
- **Facturas emitidas:** series (p. ej. `F2026-`, `R2026-` para rectificativas). Numeración correlativa
  por serie y año, **sin huecos**, asignada al emitir (los borradores no tienen número). Líneas con
  cantidad, precio, descuento y tipo de IVA. Recargo de equivalencia, retención IRPF, varios
  vencimientos y estado (borrador / emitida / cobrada parcial / cobrada / vencida).
- **Una factura emitida no se borra ni se edita:** se anula con una rectificativa. Registro de
  cambios (quién, cuándo, qué).
- **Presupuestos → pedidos/albaranes → factura** (convertir con un clic, conservando el enlace).
- PDF con el logo y los datos fiscales de Bocubi, reutilizando el sistema de impresión
  `src/app/imprimir`. Envío por email con Resend.
- Facturas recurrentes, generadas por cron.

### Compras
- Facturas recibidas y gastos (con el mismo modelo de líneas que las ventas), con adjunto PDF o imagen.
- **OCR:** subir PDF o foto, extraer los datos con el SDK de Anthropic que ya usa la app y crear un
  borrador para revisar. Nunca se contabiliza sin confirmación del usuario.
- **Importar factura:** XML Facturae y PDF.
- **Bienes de inversión:** alta del activo, cuenta 21x y tabla de amortización lineal según las tablas
  fiscales, con asiento de amortización generado por periodo.
- **Cierre de trimestres:** bloquea crear o modificar documentos con fecha dentro de un trimestre
  cerrado (solo un admin puede reabrirlo, y queda registrado).

### Bancos / Caja
- Cuentas bancarias y caja. Importar extractos (Norma 43 / CSV / Excel).
- **Conciliación:** emparejar movimientos con facturas o vencimientos, con sugerencias automáticas por
  importe, fecha y concepto.
- **Cobros y pagos:** registrar cobros y pagos totales o parciales; se generan sus asientos.
- **Recibos y remesas:** remesas de adeudos SEPA (fichero `pain.008`) y transferencias (`pain.001`).

### Contabilidad (sin menú propio; se ve en Informes)
- Plan General Contable PYMES precargado y editable.
- **Asientos automáticos** al emitir o recibir facturas, cobrar, pagar y amortizar. Ejemplos:
  venta = 430 a 700 + 477; compra = 600/62x + 472 a 400; retención soportada 473; retención
  practicada 4751; cobro = 572 a 430.
- Asientos manuales: apertura, cierre, regularización, nóminas…
- Diario, mayor, sumas y saldos, balance, pérdidas y ganancias. Todo exportable a Excel y PDF.

### Impuestos
- Cálculo de **borradores** de los modelos a partir de los libros: 303/390 (IVA), 111/190 y 115/180
  (retenciones), 347 (operaciones con terceros por encima de 3.005,06 €), y 130/100 solo si aplica
  (ver pregunta abierta). Muestra casillas y totales y permite exportar el fichero de la AEAT cuando
  sea viable. **No se presenta nada automáticamente.**
- Calendario fiscal con plazos y avisos por email (cron existente).
- Libros registro de IVA (expedidas y recibidas).

### Disco virtual
- Almacenamiento de archivos (Vercel Blob) con carpetas, enlazado a facturas y gastos.

### Integración con el cuadro de mandos
- Las facturas emitidas, agrupadas por semana ISO (mes = mes del jueves), pueden rellenar los datos de
  ventas semanales que hoy se teclean. Hacerlo como **opción configurable**, sin borrar los datos manuales.

## Reglas técnicas

- **Importes en céntimos (enteros)** en TypeScript y `numeric(14,2)` en la base de datos. Redondeo del
  IVA por línea o por total (configurable; por defecto, por total de cada tipo).
- Cálculos puros (totales, impuestos, asientos, modelos) en `src/lib/gestion/*.ts` **con tests
  Vitest**, como `engine.ts`.
- **Preparado para Verifactu, sin implementarlo todavía:** numeración inmutable, facturas emitidas no
  borrables, registro de eventos y un campo para huella/encadenado reservado para el futuro.
- Permisos: nuevo permiso `gestion` en `src/lib/auth.ts`. Admin = todo; editor = crear y editar;
  lector = solo ver. Cierres y reaperturas, solo admin.
- Datos de la empresa (razón social, CIF, domicilio, logo, IBAN, series, ejercicio) en
  **Configuración → Empresa**.

## Plan por fases (detente al final de cada una para revisar el preview)

1. **Base:** layout con panel lateral, Configuración → Empresa, Contactos, Catálogo y plan contable.
2. **Ventas:** presupuestos, albaranes, facturas, rectificativas, PDF, email y recurrentes.
3. **Compras:** facturas recibidas, gastos, OCR, importación y bienes de inversión.
4. **Contabilidad:** asientos automáticos y manuales; diario, mayor, balance y PyG.
5. **Bancos / Caja:** extractos, conciliación, cobros y pagos, remesas SEPA.
6. **Impuestos e informes:** modelos, calendario fiscal, libros de IVA y cierre de trimestres.
7. **Importar desde Contasimple** (exportaciones Excel) y conexión con el cuadro de mandos.

En cada fase: migración nueva, pantallas, acciones, tests, entrada en el changelog, commit y push a la
rama, y la URL del preview.

## Preguntas abiertas (responder antes de la fase 1)

- ¿Bocubi es **sociedad (SL)** o autónomo? Si es SL, los modelos 130/100 no aplican y se usan 200/202
  (Impuesto sobre Sociedades).
- ¿Régimen de IVA general? ¿Hay ventas intracomunitarias o exportaciones (modelo 349)?
- ¿Qué series de facturación usáis hoy, y cuál es la última factura emitida de cada serie en 2026?
- ¿Se cobra con domiciliación SEPA? ¿Con qué bancos trabajáis?
