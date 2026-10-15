# Prompt: app de Facturación y Contabilidad (sustituto de Contasimple)

> **Estado: BORRADOR.** Faltan las capturas marcadas como `[PENDIENTE]`. Cuando esté completo, se crea
> un **repositorio nuevo** y se trabaja fase a fase (una fase = una rama = un preview de Vercel).
> Este proyecto **no tiene relación con Bocubi**: este documento se guarda aquí solo de forma provisional.

---

## Contexto

Crea **desde cero una app web independiente** de facturación y contabilidad, multiempresa, que sustituya
a Contasimple. Debe ser en **español de España**: formato `1.234,56 €`, fechas `dd/mm/aaaa` y periodos
por trimestre (`2026-3T`).

**Stack:** Next.js 15 (App Router, Server Components + Server Actions) · TypeScript estricto ·
Tailwind CSS 4 · Postgres (`postgres`; en local, PGlite) · migraciones versionadas e inmutables ·
consultas parametrizadas · auth propia (bcrypt + JWT en cookie) · Resend (emails) · Anthropic SDK
(OCR de facturas) · Vercel Blob (archivos) · Recharts (gráficos) · ExcelJS (importar/exportar) ·
Vitest · despliegue en Vercel.

Crea un `CLAUDE.md` con las reglas del proyecto y una página de **Novedades** (changelog en lenguaje de
negocio) que se actualice en cada cambio. Antes de cada commit: `lint`, `typecheck` y `test`.

## Empresas (multiempresa desde el primer día)

- Tabla `companies`. **Todas** las tablas de negocio llevan `company_id` y todas las consultas filtran
  por la empresa activa. Habrá tests que demuestren que un usuario nunca ve datos de otra empresa.
- **Selector de empresa en la cabecera**, que muestra el nombre y el NIF de la empresa activa.
- Cada usuario tiene acceso a una o varias empresas, con un rol en cada una (admin / editor / lector).
- **Tipo de empresa:** *persona física (autónomo)* o *sociedad*. Este dato decide qué se hace:
  - **Autónomo:** sus facturas emitidas llevan retención IRPF (15 % por defecto, 7 % en los primeros
    años) y le corresponden los modelos **130 y 100**.
  - **Sociedad (SL):** sus facturas normalmente no llevan retención, y le corresponden los modelos
    **200 y 202**.
- Cada empresa tiene sus propios datos fiscales, series, plan contable, bancos, ejercicios y cierres.
- Configuración → Empresas: **Nueva empresa** (se crea con el plan contable, los impuestos y las series
  por defecto) y **Gestión de empresas** (editar o archivar; nunca borrar una empresa con movimientos).

### Actividad de las empresas
- **Representación de jugadores (agencia deportiva):**
  - Facturas de comisiones a clubes y jugadores, a menudo **cobradas en plazos** a lo largo de varias
    temporadas (varios vencimientos por factura).
  - **Clientes extranjeros:** intracomunitarios con inversión del sujeto pasivo (modelo 349), o de fuera
    de la UE sin IVA.
  - Facturas en otra moneda (con tipo de cambio) y en inglés.
- **Abogacía:**
  - **Suplidos:** gastos pagados en nombre del cliente que van en la factura pero fuera de la base del IVA.
  - **Provisiones de fondos:** anticipos que se descuentan en la factura final.

## Estructura de pantalla (común a toda la app)

- **Cabecera:**
  - Botón ☰ para plegar o desplegar el menú, y logo.
  - **Buscador global** de facturas, contactos y productos por número, nombre o NIF.
  - **Selector de empresa**, ayuda (?) y **campana de notificaciones**. Las notificaciones avisan de
    tareas terminadas: "OCR procesado – ver factura", "Exportación preparada – descargar desde el disco
    virtual"…, con los botones *Ver notificaciones* y *Ver mensajes*.
- **Panel lateral** con un botón destacado **"+ Crear"** arriba. Despliega un menú rápido: factura,
  presupuesto, albarán, factura recibida, gasto, cliente, proveedor y producto. Plegado, el panel
  muestra solo iconos.
- **Migas de pan** encima del título de cada página (p. ej. `Inicio > Facturación > Registro de facturas
  emitidas`), y las acciones principales arriba a la derecha.
- En el móvil, el panel lateral pasa a ser un menú desplegable y las tablas se desplazan en horizontal.

## Menú lateral

| Sección | Subapartados |
|---|---|
| **Inicio** | Página principal (ver detalle abajo) |
| **Ventas** | Facturas emitidas · Facturas borrador · Albaranes · Presupuestos · Exportar · Importar · Cierre de trimestres |
| **Compras** | Facturas recibidas · Bienes de inversión · Gastos · OCR · Importar factura · Exportar · Importar · Cierre de trimestres |
| **Contactos** | Clientes · Proveedores · Importar |
| **Catálogo** | `[PENDIENTE captura]`. Previsto: Productos y servicios |
| **Bancos / Caja** | Resumen · Movimientos · Conciliación · Cobros y pagos · Recibos y remesas (Recibos bancarios · Remesas · Recibos procesados · Devoluciones) |
| **Impuestos** | Resumen · Calendario fiscal · IVA (303, 390) · IRPF (130, 100), solo autónomos · Impuesto sobre Sociedades (200, 202), solo sociedades · Retenciones (111, 190) · Ret. alquileres (115, 180) · Op. terceras personas (347) · Intracomunitarias (349) · `[PENDIENTE: resto de la lista]` |
| **Disco virtual** | Archivos y carpetas (adjuntos de facturas, exportaciones, documentos) |
| **Informes** | Resumen · Pérdidas y ganancias · Informes de empresas · Informes de horas trabajadas · Balance · Libro diario · Libro mayor · Sumas y saldos · Libros registro de IVA |
| **Otros** | Notas · Jornada laboral · Correo electrónico · Mensajes |
| **Configuración** | Resumen · Ajustes de usuario · Ajustes de empresa · Otras opciones · Empresas |

**Fuera de alcance:** Mi plan, Marketplace y TPV (son propios de Contasimple como producto).

---

## Pantallas detalladas

### Inicio — Página principal

Todo se calcula para la **empresa activa** y el **periodo elegido** (selector arriba a la derecha:
trimestre `2026-4T`, mes o año). Bloques, de arriba abajo:

1. **Resumen.** Tres tarjetas:
   - **Ingresos:** total; % de variación frente al mismo periodo anterior (flecha y color); IVA
     repercutido; número de facturas.
   - **Gastos:** total; % de variación; IVA soportado imputable; número de facturas.
   - **Resultado:** ingresos − gastos; % de variación; IVA neto (repercutido − imputable).
2. **Ingresos y gastos:** gráfico de barras por mes del periodo.
3. **Facturas:** dos tarjetas, *Ingresos* y *Gastos*, con las últimas facturas o las mayores (importe,
   cliente o proveedor, estado) y un botón *Ver más* que lleva al listado.
4. **Cobros y pagos:** gráfico de los próximos meses con cuatro series: *Cobrado*, *Previsión de cobro*
   (vencimientos pendientes), *Pagado* y *Previsión de pago*.
5. **Tesorería — últimos movimientos:** gráfico de los últimos 12 meses con *Cobros* y *Pagos*.
6. **Principales clientes y proveedores:** dos tarjetas con el top 5 por importe y un enlace *Ver más*.
7. **Resumen de facturación:** tabla con una fila por mes del periodo, más una fila *Otros* (documentos
   del periodo fuera de esos meses) y la fila **TOTAL**. Columnas: Número de facturas · Total base
   imponible · Total IVA · Total retención · Total facturas. Pestañas para cambiar la tabla:
   **Emitidas · Recibidas · Bienes de inversión · Gastos**.
- Debajo de los bloques 2, 3 y 4 hay un enlace **"[+] Ver comentarios"**: comentarios internos por
  bloque y periodo (p. ej. "en septiembre se cobró el traspaso X").
- Si un bloque no tiene datos, muestra un estado vacío amable ("No hay datos todavía").

### Ventas — Registro de facturas emitidas

- Migas de pan: `Facturación > Registro de facturas emitidas`. Botón **Nueva factura** arriba a la derecha.
- **Filtro de periodo** (trimestre por defecto: el actual), más búsqueda por cliente o número y
  filtro por estado.
- **Tabla "Listado de facturas emitidas":**

  | Número | Fecha ▼ | Estado ⓘ | Cliente | Base imponible | IVA | Retención | Total ⓘ | Operaciones |
  |---|---|---|---|---|---|---|---|---|

  - **Número:** enlace que abre la factura. Formato `AAAA-NNNN` (p. ej. `2026-0011`), correlativo por
    serie y año.
  - **Fecha:** ordenada de más reciente a más antigua por defecto. Todas las columnas se pueden ordenar.
  - **Estado:** Pendiente / Cobrada parcial / Cobrada (ⓘ explica cada estado).
  - **Operaciones:** ver, descargar PDF, enviar por email, duplicar, marcar como cobrada, crear
    rectificativa.
  - **Fila TOTALES** al final, con las sumas de base imponible, IVA, retención y total.
- **Leyenda:** las filas de facturas **vencidas y no cobradas** se resaltan con un color, explicado
  bajo la tabla.

### Ventas — Presupuestos

- Migas de pan: `Facturación > Presupuestos`. Botón **Nuevo presupuesto**.
- **Tabla "Listado de presupuestos"** con las mismas columnas que las facturas emitidas. Numeración
  `P-AAAA-NNNN` (p. ej. `P-2025-0012`).
- **Estados:** Creado / Enviado / Aceptado / Rechazado / Facturado.
- **Operaciones:** convertir en albarán o en factura (queda enlazado), duplicar, PDF, email.
- Fila TOTALES.

### Ventas — Albaranes y Facturas borrador

- Misma estructura de listado. Los borradores no tienen número hasta que se emiten. Se pueden emitir
  uno a uno o varios a la vez.

### Compras — Registro de facturas recibidas

- Migas de pan: `Facturación > Registro de facturas recibidas`. Botones **Nueva factura vía OCR** y
  **Nueva factura**.
- **Filtro de periodo** (trimestre).
- **Tabla "Listado de facturas recibidas":**

  | Número | Fecha ▼ | Estado ⓘ | Proveedor | Base imponible | IVA | Retención | Total ⓘ | Imputable ⓘ | Operaciones |
  |---|---|---|---|---|---|---|---|---|---|

  - **Número:** el del proveedor, tal cual (admite letras y barras, p. ej. `113455-2026/ESF`).
  - **Estado:** Pendiente / Pagada.
  - **Imputable:** % deducible del gasto (p. ej. 100 %, o 50 % para vehículos de uso mixto).
  - **Fila TOTALES:** suma de base, IVA, retención y total. En la columna Imputable, la base y el IVA
    imputables: `B.I. 1.710,29 € (IVA 353,62 €)`.
- **Leyenda:** las filas de facturas **vencidas y no pagadas** se resaltan.
- **Al pulsar el número** se abre un **panel de detalle** (modal con scroll) titulado "Detalle de la
  factura recibida número X":
  - **Información de la factura:** Periodo · Número · Fecha · Fecha de vencimiento · **Tipo de gasto**
    (cuenta contable con descripción, p. ej. `624. Transportes (gasolina, tarjetas metro, etc.)`) ·
    Estado · Notas privadas · Retención (%) · Imputación (%) · Imputación a IVA · Fecha de operación ·
    Tipo de operación (Nacional / Intracomunitaria / Importación / Inversión del sujeto pasivo) ·
    Criterio de caja (Sí/No).
  - **Información del proveedor:** nombre o razón social, NIF y dirección.
  - Líneas, totales y el archivo adjunto (vista previa).
  - Botones: **Descargar factura** · **Editar factura** · **Cerrar**.

### Compras — OCR

- Subir un PDF o una foto (también varias a la vez). Se procesan en segundo plano con la API de
  Anthropic, que extrae proveedor, NIF, número, fechas, base, IVA, retención, total y tipo de gasto
  sugerido.
- Al terminar, llega una notificación ("Se ha terminado de procesar tu documento OCR – Ver factura").
  Se crea una **factura recibida en borrador** para revisar. Nunca se contabiliza sin confirmación.
- Si el NIF no existe, se propone crear el proveedor.

### `[PENDIENTE]` resto de pantallas

Formulario de nueva factura, PDF de la factura, Clientes, Proveedores, Catálogo, Gastos, Bancos,
Impuestos, Informes, Otros y Configuración. Mientras lleguen las capturas, aplicar las funciones del
apartado siguiente con el mismo estilo de listados (filtro de periodo, tabla ordenable, fila de
totales, leyenda y panel de detalle).

---

## Funciones por sección

### Contactos
- Clientes y proveedores: razón social, nombre comercial, NIF/CIF/VAT (con validación), dirección,
  país, idioma de facturación, moneda, email, teléfono, forma de pago y vencimiento por defecto, IBAN,
  mandato SEPA, tipo de operación por defecto (nacional / intracomunitaria / extracomunitaria),
  retención por defecto, cuenta contable (430xxxx / 400xxxx, generada sola) y notas.
- Importar desde Excel o CSV con un asistente que mapea las columnas.

### Catálogo
- Productos y servicios: referencia, descripción (en español y en inglés), precio, tipo de IVA y
  cuenta de ventas (70x).

### Ventas
- **Facturas:** series configurables; numeración correlativa por serie y año, **sin huecos**, asignada
  al emitir. Las líneas llevan cantidad, precio, descuento y tipo de IVA o exención (con su mención
  legal). Además: suplidos, provisiones de fondos, retención, **varios vencimientos**, moneda e idioma.
- **Una factura emitida no se borra ni se edita:** se corrige con una **rectificativa** (serie propia).
  Todo cambio queda registrado (quién, cuándo, qué).
- **Presupuesto → albarán → factura**, convirtiendo con un clic y conservando el enlace entre documentos.
- **PDF** con el logo y los datos fiscales de la empresa. **Envío por email** con Resend, y queda
  registrado en Otros → Correo electrónico.
- **Exportar / Importar** a Excel y CSV. Las exportaciones grandes se generan en segundo plano, se
  dejan en el disco virtual y avisan con una notificación.
- **Cierre de trimestres:** un único cierre por empresa y trimestre, que bloquea crear o modificar
  documentos de ventas y compras con fecha en ese trimestre. Solo un admin puede reabrirlo, y queda
  registrado.

### Compras
- **Facturas recibidas y gastos** (tickets y gastos sin factura completa): mismo modelo de líneas,
  con un adjunto obligatorio u opcional (configurable).
- **Importar factura:** XML Facturae y PDF (este último pasa por el OCR).
- **Bienes de inversión:** alta del activo (cuenta 21x) y tabla de amortización lineal según las
  tablas fiscales, con su asiento por periodo.

### Bancos / Caja
- Cuentas bancarias y caja. Importar extractos (Norma 43, CSV o Excel).
- **Conciliación:** emparejar movimientos con vencimientos, con sugerencias por importe, fecha y
  concepto.
- **Cobros y pagos:** totales o parciales, cada uno con su asiento.
- **Recibos y remesas:**
  - Recibos bancarios: un recibo por cada vencimiento domiciliado.
  - Remesas de adeudos SEPA (`pain.008`) y de transferencias a proveedores (`pain.001`).
  - Recibos procesados: histórico de remesas enviadas.
  - Devoluciones: con motivo y gastos; reabren el vencimiento y generan su asiento.

### Contabilidad (se consulta en Informes)
- Plan General Contable PYMES precargado y editable por empresa.
- **Asientos automáticos** al emitir o recibir facturas, cobrar, pagar y amortizar. Ejemplos:
  venta = 430 a 705 + 477 (+ 473 si hay retención); compra = 6xx + 472 a 400 (+ 4751 si hay
  retención); cobro = 572 a 430.
- Asientos manuales: apertura, cierre, regularización, nóminas…

### Impuestos
- **Borradores** calculados desde los libros: 303/390, 130/100 (autónomos), 200/202 (sociedades),
  111/190, 115/180, 347 (más de 3.005,06 € por tercero) y 349. Se muestran las casillas y se exporta
  el fichero de la AEAT cuando sea viable. **No se presenta nada automáticamente.**
- **Calendario fiscal** con plazos y avisos por email.
- Libros registro de IVA de facturas expedidas y recibidas.

### Informes
- Resumen; Pérdidas y ganancias; Balance; Diario; Mayor; Sumas y saldos.
- **Informes de empresas:** por cliente y proveedor, con saldos pendientes y antigüedad de la deuda.
- **Horas trabajadas:** a partir de Jornada laboral.
- Todo exportable a Excel y PDF.

### Otros
- **Notas:** notas internas, enlazables a un contacto o documento.
- **Jornada laboral:** fichaje de entrada, salida y pausas, desde el móvil. Una edición solo la puede
  hacer un admin, con motivo registrado. Exportación mensual por trabajador (registro horario obligatorio).
- **Correo electrónico:** historial de envíos y plantillas.
- **Mensajes:** mensajes internos entre los usuarios de la empresa, más los avisos del sistema.

### Configuración
- **Ajustes de usuario:** credenciales de acceso, datos personales y estadísticas de uso.
- **Ajustes de empresa:** datos de la empresa (incluido el tipo autónomo/sociedad) · Sistema
  VERI*FACTU (solo informativo: "no activado") · facturas · facturas borrador · presupuestos ·
  albaranes · impuestos · `[PENDIENTE: posible apartado intermedio]` · cuentas de tesorería · métodos
  de pago y cobro · cuentas contables · certificados digitales (guardados cifrados) · valores por
  defecto de clientes, proveedores y catálogo · gestión de usuarios · gestión de etiquetas ·
  centros administrativos (DIR3).
- **Otras opciones:** ordenación y filtrado por defecto · aplicaciones externas (claves en variables
  de entorno, nunca en claro) · remesas bancarias (identificador de acreedor SEPA) · configuración de
  correo · tareas en segundo plano · importar.
- **Empresas:** nueva empresa y gestión de empresas.

### Disco virtual
- Archivos y carpetas en Vercel Blob, por empresa: adjuntos de facturas, exportaciones y documentos.

## Reglas técnicas

- **Importes en céntimos (enteros)** en TypeScript y `numeric(14,2)` en la base de datos. Los cálculos
  (totales, IVA, retenciones, asientos, modelos) son **funciones puras con tests**.
- Si falta un dato, se muestra "Sin dato", nunca un 0 inventado.
- **Preparado para Verifactu, sin implementarlo todavía:** numeración inmutable, facturas emitidas no
  borrables, registro de eventos y campos reservados para la huella y el encadenado.
- Roles por empresa: **admin** (todo, incluidos cierres y usuarios), **editor** (crear y editar) y
  **lector** (solo ver).

## Plan por fases (detente al final de cada una para revisar el preview)

1. **Base:** proyecto, login, multiempresa, layout (cabecera, panel lateral, + Crear), Configuración
   (empresa, usuarios, impuestos, series, métodos de pago), Contactos, Catálogo y plan contable.
2. **Ventas:** facturas emitidas, borradores, rectificativas, presupuestos, albaranes, PDF y email.
3. **Compras:** facturas recibidas (con el panel de detalle), gastos, OCR, importar factura y bienes de inversión.
4. **Inicio:** página principal completa.
5. **Contabilidad:** asientos automáticos y manuales, diario, mayor, balance y PyG.
6. **Bancos / Caja:** extractos, conciliación, cobros y pagos, recibos y remesas.
7. **Impuestos e informes:** modelos, calendario fiscal, libros de IVA y cierre de trimestres.
8. **Otros y disco virtual:** notas, jornada laboral, correo, mensajes y archivos.
9. **Migración desde Contasimple:** importar las exportaciones de contactos, facturas emitidas y
   recibidas, y comprobar que los totales por trimestre cuadran.

## Preguntas abiertas

- ¿Qué empresas se darán de alta al principio, y de qué tipo es cada una (autónomo o SL)?
- ¿Qué series de facturación se usan, y cuál es la última factura emitida de cada una en 2026?
- ¿Se cobra por domiciliación SEPA? ¿Con qué bancos se trabaja?
- ¿Quién usará la app, y con qué rol?
