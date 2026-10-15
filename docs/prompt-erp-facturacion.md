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

## La empresa y la multiempresa

La empresa principal es una **SL de representación de jugadores (agencia deportiva) y abogacía**. La
app debe ser **multiempresa desde el primer día**:
- Tabla `companies`; **todas** las tablas del módulo llevan `company_id`, y todas las consultas filtran por él.
- Selector de empresa en la cabecera. La empresa activa se guarda en la sesión.
- Cada usuario tiene acceso a una o varias empresas, con un rol en cada una.
- Cada empresa tiene sus propios datos fiscales, series, plan contable, bancos, ejercicios y cierres.
- Configuración → Empresas → **Nueva empresa** crea una empresa con el plan contable, los impuestos y
  las series por defecto. **Gestión de empresas** permite editarlas o archivarlas (nunca borrarlas si
  tienen movimientos).
- Tests que demuestren que un usuario nunca ve datos de una empresa a la que no tiene acceso.

### Particularidades del negocio
- **Representación de jugadores:** comisiones a clubes y jugadores, a menudo **cobradas en plazos
  que abarcan varias temporadas** (vencimientos múltiples por factura) y a **clientes extranjeros**
  (intracomunitarios con inversión del sujeto pasivo y modelo 349, o de fuera de la UE sin IVA). Facturas
  en otra moneda (con tipo de cambio) y en inglés.
- **Abogacía:** **suplidos** (gastos pagados en nombre del cliente: van en la factura pero fuera de la base
  del IVA) y **provisiones de fondos** (anticipos que se descuentan en la factura final).
- Como SL, sus facturas normalmente **no llevan retención IRPF**. La retención sí debe poder usarse en
  facturas recibidas de profesionales (modelo 111) y en alquileres (modelo 115).

## Navegación

El módulo tiene su propio **panel lateral** (rutas bajo `src/app/(app)/gestion/…`), con un botón
destacado **"+ Crear"** arriba (menú rápido: factura, presupuesto, factura recibida, gasto, cliente,
proveedor, producto, movimiento de banco). Menú, en este orden:

| Sección | Subapartados |
|---|---|
| **Inicio** | Panel: ventas, gastos y resultado del trimestre/año, cobros y pagos pendientes, vencidos, saldo de bancos, próximos impuestos |
| **Ventas** | Facturas emitidas · Facturas borrador · Albaranes · Presupuestos · Exportar · Importar · Cierre de trimestres |
| **Compras** | Facturas recibidas · Bienes de inversión · Gastos · OCR · Importar factura · Exportar · Importar · Cierre de trimestres |
| **Contactos** | Clientes · Proveedores · Importar |
| **Catálogo** | `[PENDIENTE captura]`. Previsto: Productos y servicios, Categorías, Tarifas |
| **Bancos / Caja** | Resumen · Movimientos · Conciliación · Cobros y pagos · Recibos y remesas (Recibos bancarios · Remesas · Recibos procesados · Devoluciones) |
| **Impuestos** | Resumen · Calendario fiscal · IVA (303, 390) · Impuesto sobre Sociedades (200, 202) · Retenciones (111, 190) · Ret. alquileres (115, 180) · Op. terceras personas (347) · Intracomunitarias (349) · `[PENDIENTE: resto de la lista]` |
| **Disco virtual** | Archivos y carpetas (adjuntos de facturas, tickets, documentos) |
| **Informes** | Resumen · Pérdidas y ganancias · Informes de empresas · Informes de horas trabajadas. Añadir además: Balance, Libro diario, Libro mayor, Sumas y saldos, Libros registro de IVA, Ventas por cliente/producto |
| **Otros** | Notas · Jornada laboral · Correo electrónico · Mensajes (submenú `[PENDIENTE]`) |
| **Configuración** | Resumen · Ajustes de usuario · Ajustes de empresa · Otras opciones · Empresas (Nueva empresa · Gestión de empresas) |

**Fuera de alcance** (propio de Contasimple como producto): Mi plan, Marketplace y Contasimple TPV.

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
- **Facturas borrador:** listado propio de los borradores (sin número) para revisarlos y emitirlos uno
  a uno o en lote.
- **Facturas emitidas:** series (p. ej. `F2026-`, `R2026-` para rectificativas). Numeración correlativa
  por serie y año, **sin huecos**, asignada al emitir (los borradores no tienen número). Líneas con
  cantidad, precio, descuento y tipo de IVA. Recargo de equivalencia, retención IRPF, varios
  vencimientos y estado (borrador / emitida / cobrada parcial / cobrada / vencida).
- **Una factura emitida no se borra ni se edita:** se anula con una rectificativa. Registro de
  cambios (quién, cuándo, qué).
- **Presupuestos → pedidos/albaranes → factura** (convertir con un clic, conservando el enlace).
- PDF con el logo y los datos fiscales de la empresa activa, reutilizando el sistema de impresión
  `src/app/imprimir`. Envío por email con Resend.
- **Exportar / Importar:** facturas y presupuestos a Excel y CSV, e importación con el asistente existente.
- **Cierre de trimestres:** el mismo cierre que en Compras (es un único cierre por trimestre que bloquea
  ventas y compras).

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
- **Recibos y remesas:**
  - Recibos bancarios: un recibo por cada vencimiento domiciliado (cliente, mandato SEPA, importe, fecha de cargo).
  - Remesas: agrupar recibos y generar el fichero de adeudos SEPA (`pain.008`); remesas de pago a
    proveedores por transferencia (`pain.001`).
  - Recibos procesados: histórico de las remesas enviadas y su estado.
  - Devoluciones: marcar un recibo como devuelto (con motivo y gastos), reabrir el vencimiento y generar su asiento.

### Contabilidad (sin menú propio; se ve en Informes)
- Plan General Contable PYMES precargado y editable.
- **Asientos automáticos** al emitir o recibir facturas, cobrar, pagar y amortizar. Ejemplos:
  venta = 430 a 700 + 477; compra = 600/62x + 472 a 400; retención soportada 473; retención
  practicada 4751; cobro = 572 a 430.
- Asientos manuales: apertura, cierre, regularización, nóminas…
- Diario, mayor, sumas y saldos, balance, pérdidas y ganancias. Todo exportable a Excel y PDF.

### Impuestos
- Cálculo de **borradores** de los modelos a partir de los libros: 303/390 (IVA), 111/190 y 115/180
  (retenciones), 347 (operaciones con terceros por encima de 3.005,06 €), 349 (intracomunitarias) y
  200/202 (Impuesto sobre Sociedades: pagos fraccionados y ayuda con la declaración anual a partir del
  resultado contable). Los modelos 130 y 100 no se implementan: son de autónomos. Muestra casillas y totales y permite exportar el fichero de la AEAT cuando
  sea viable. **No se presenta nada automáticamente.**
- Calendario fiscal con plazos y avisos por email (cron existente).
- Libros registro de IVA (expedidas y recibidas).

### Informes
- **Resumen:** ingresos, gastos y resultado por mes, trimestre y año, comparados con el año anterior.
- **Pérdidas y ganancias** y **balance** según el PGC PYMES, con detalle por cuenta.
- **Informes de empresas:** ventas y compras por cliente y proveedor, saldos pendientes y antigüedad de deuda.
- **Horas trabajadas:** a partir de Jornada laboral, por persona y periodo.
- Todo exportable a Excel y PDF.

### Otros
- **Notas:** notas internas, opcionalmente enlazadas a un cliente, proveedor o documento.
- **Jornada laboral:** registro diario de entrada y salida, con pausas, para cumplir el registro horario
  obligatorio. Fichaje desde el móvil, edición solo por admin con motivo registrado, y exportación
  mensual por trabajador.
- **Correo electrónico:** historial de los emails enviados desde la app (facturas, presupuestos,
  recordatorios de cobro) y plantillas editables. Envío con Resend.
- **Mensajes:** `[PENDIENTE captura]`.

### Configuración
- **Ajustes de usuario** (credenciales de acceso, datos personales, estadísticas): reutilizar las
  páginas de Perfil y Usuarios que ya existen.
- **Ajustes de empresa:**
  - Datos de la empresa: razón social, CIF, domicilio, logo e IBAN.
  - Sistema VERI*FACTU: pantalla informativa ("no activado") por ahora.
  - Facturas: series, numeración, textos legales, pie, plantilla del PDF y vencimientos por defecto.
  - Facturas borrador.
  - Presupuestos y albaranes: series, validez y textos.
  - Impuestos: tipos de IVA, recargo y retenciones disponibles.
  - Cuentas de tesorería: bancos y caja, con IBAN y cuenta contable 57x.
  - Métodos de pago y cobro: transferencia, domiciliación, tarjeta, efectivo… con sus días de vencimiento.
  - Cuentas contables: el plan PGC PYMES, editable.
  - Certificados digitales: subir el certificado de la empresa (cifrado) para Verifactu y la AEAT en el futuro.
  - Clientes/proveedores y Catálogo: valores por defecto (cuentas, IVA, forma de pago, numeración de referencias).
  - Gestión de usuarios: reutilizar la página Usuarios existente y añadir el permiso `gestion`.
  - Gestión de etiquetas: etiquetas libres con color para facturas, gastos, contactos y productos, filtrables en los listados.
  - Centros administrativos: los datos DIR3 (oficina contable, órgano gestor, unidad tramitadora) para
    facturar a administraciones públicas.
  - `[PENDIENTE: confirmar si hay algún apartado entre Impuestos y Cuentas de tesorería]`.
- **Otras opciones:**
  - Ordenación y filtrado: orden y filtros por defecto de cada listado, por usuario.
  - Aplicaciones externas: claves de integraciones (p. ej. la API de Anthropic para el OCR), guardadas
    como variables de entorno, nunca en la base de datos en claro.
  - Remesas bancarias: identificador de acreedor SEPA, sufijo y cuenta de cargo.
  - Configuración de correo: remitente, firma y plantillas.
  - Tareas en segundo plano: estado de importaciones, remesas y envíos masivos.
  - Importar: punto único de importación de datos.

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
- Datos de la empresa y ajustes de documentos en **Configuración → Ajustes de empresa** (ver arriba).

## Plan por fases (detente al final de cada una para revisar el preview)

1. **Base:** layout con panel lateral, Configuración → Ajustes de empresa, Contactos, Catálogo y plan contable.
2. **Ventas:** presupuestos, albaranes, facturas, rectificativas, PDF, email y recurrentes.
3. **Compras:** facturas recibidas, gastos, OCR, importación y bienes de inversión.
4. **Contabilidad:** asientos automáticos y manuales; diario, mayor, balance y PyG.
5. **Bancos / Caja:** extractos, conciliación, cobros y pagos, remesas SEPA.
6. **Impuestos e informes:** modelos, calendario fiscal, libros de IVA y cierre de trimestres.
7. **Otros:** notas, jornada laboral con informe de horas, historial de correo y mensajes.
8. **Importar desde Contasimple** (exportaciones Excel) y conexión con el cuadro de mandos.

En cada fase: migración nueva, pantallas, acciones, tests, entrada en el changelog, commit y push a la
rama, y la URL del preview.

## Preguntas abiertas (responder antes de la fase 1)

- ¿Régimen de IVA general? ¿Hay ventas intracomunitarias o exportaciones (modelo 349)?
- ¿Qué series de facturación usáis hoy, y cuál es la última factura emitida de cada serie en 2026?
- ¿Se cobra con domiciliación SEPA? ¿Con qué bancos trabajáis?
- ¿Usáis hoy Jornada laboral, Mensajes y Correo, o se pueden dejar para el final?
