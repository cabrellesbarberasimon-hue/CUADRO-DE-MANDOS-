# Prompt: cabrelleserp — Facturación y Contabilidad (sustituto de Contasimple)

> **Estado:** fase 1 (base) construida. Se trabaja fase a fase (una fase = una rama = un preview de
> Vercel). Lo marcado `[PENDIENTE]` espera captura o decisión.

## Objetivo principal

Emitir y recibir facturas **con el fin de presentar los impuestos a Hacienda**: la app calcula cada
modelo a partir de las facturas del periodo (trimestre, mes o año) y **genera el fichero oficial para
subirlo directamente a la Sede Electrónica de la AEAT**. Todo lo demás (bancos, informes, contabilidad
completa) está al servicio de ese objetivo y va después.

---

## Contexto

Crea **desde cero una app web independiente** de facturación y contabilidad, multiempresa, que sustituya
a Contasimple. Debe ser en **español de España**: formato `1.234,56 €`, fechas `dd/mm/aaaa` y periodos
por trimestre (`2026-3T`).

**Stack:** Next.js 15 (App Router, Server Components + Server Actions) · TypeScript estricto ·
Tailwind CSS 4 · Postgres en **Neon** (driver `postgres`; en local, PGlite) · migraciones versionadas e inmutables ·
consultas parametrizadas · auth propia (bcrypt + JWT en cookie) · Resend (emails) · Anthropic SDK
(OCR de facturas) · Vercel Blob (archivos) · Recharts (gráficos) · ExcelJS (importar/exportar) ·
Vitest · repositorio en **GitHub** (`cabrellesbarberasimon-hue/cabrelleserp`) y despliegue en **Vercel**.

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
- **Patrón común de los listados:** una caja con el título "Listado de …", un enlace plegable
  **"Aplicar filtros"**, una tabla con las cabeceras subrayadas (ordenables), una columna
  **Operaciones** con un menú de acciones por fila y, al pie, "Mostrando página 1 de N (X elementos en
  total)". Arriba a la derecha, un icono ⚙ (columnas visibles y opciones del listado) y el botón principal.
- **Patrón común de los formularios:** secciones plegables (cabecera con ^/v), botones arriba a la
  derecha (⋮ más acciones · ← volver · acción secundaria · **acción principal**, desactivada hasta que
  los campos obligatorios, marcados con *, estén completos) y ayudas ⓘ junto a los campos complejos.
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
| **Otros** | Notas · Jornada laboral · Correo electrónico · Mensajes (Mensajes recibidos · Mensajes enviados, con + para uno nuevo) |
| **Configuración** | Resumen · Ajustes de usuario · Ajustes de empresa · Otras opciones · Empresas |

**Fuera de alcance:** Mi plan, Marketplace y TPV (son propios de Contasimple como producto).

---

## Pantallas detalladas

### Inicio — Página principal

Todo se calcula para la **empresa activa** y el **periodo elegido** (selector arriba a la derecha:
un trimestre como `2026-4T`, o el año completo `2026`). Bloques, de arriba abajo:

1. **Resumen.** Tres tarjetas:
   - **Ingresos:** total; % de variación frente al mismo periodo anterior (flecha y color); IVA
     repercutido; número de facturas.
   - **Gastos:** total; % de variación; IVA soportado imputable; número de facturas.
   - **Resultado:** ingresos − gastos; % de variación; IVA neto (repercutido − imputable).
2. **Ingresos y gastos:** gráfico de líneas por mes (enero … diciembre, más "Otros") con tres series:
   *Ingresos* (azul), *Gastos* (rojo, discontinua) y *Beneficio acumulado* (gris).
3. **Facturas:** dos tarjetas con un **gráfico de anillo** que muestra en el centro el número de
   facturas del periodo:
   - *Ingresos:* cobradas frente a "Facturas pendientes de cobro" y "Facturas vencidas".
   - *Gastos:* "Facturas pagadas" frente a "Facturas pendientes de pago".
   - Cada tarjeta tiene un desplegable *Ver más* con el detalle o el enlace al listado.
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

- **Panel de detalle de una factura emitida** (al pulsar el número), titulado "Detalle de la factura
  emitida número X":
  - **Información de la factura:** Periodo · Número · Fecha · Fecha de vencimiento · Tipo de ingreso
    (p. ej. `705. Prestación de servicios`) · Estado · Notas privadas · Retención · Notas en la factura ·
    Fecha de operación · Tipo de operación · Criterio de caja.
  - **Información del cliente:** nombre o razón social, NIF y dirección.
  - Líneas y totales.
  - Botones: **Descargar factura** · **Editar factura** (solo si no está emitida definitivamente; si lo
    está, ofrece "Crear rectificativa") · **Cerrar**.

### Ventas — PDF de la factura (A4 vertical, Helvetica/Arial, en blanco y negro)

1. **Cabecera:**
   - A la izquierda: nombre o razón social del emisor (en negrita), dirección, CP y provincia,
     población y país, y NIF. Logo opcional encima.
   - A la derecha, alineada arriba: la **fecha** de la factura (en negrita).
2. **Título** centrado y grande: **FACTURA** (o "FACTURA RECTIFICATIVA", "PRESUPUESTO", "ALBARÁN"; en
   inglés, INVOICE).
3. **"Número de factura: 2026-0010"** en negrita. Si es rectificativa, debajo: "Rectifica a la factura
   X de fecha Y".
4. **Recuadro del cliente:** nombre (en negrita), dirección, CP y población, provincia y país, teléfono,
   web (Url) y NIF.
5. **Tabla de conceptos** con cabecera gris: **CONCEPTO · UDS. · BASE UD. · BASE TOTAL · % IVA · IVA**
   (y **DTO.** solo si alguna línea lleva descuento). Debajo de cada línea puede ir una **descripción
   ampliada** en negrita y a ancho completo (p. ej. "10 % sobre 30.000 €").
6. **Al pie de la página:**
   - **Desglose de impuestos** con cabecera gris: **BASE IMPONIBLE · TIPO IMPUESTO · IMPUESTO**. Una
     fila por impuesto: "IVA 21 %" con su importe, y "Retención 15 %" en negativo.
   - Debajo y a la derecha, el **recuadro de totales**: Total base imponible · Total IVA · Total
     retención (negativo) · **TOTAL** (en negrita). Si hay suplidos o provisiones de fondos, salen
     como filas propias antes del TOTAL.
7. **Notas en la factura** al pie, p. ej. **"CUENTA BANCARIA: ESxx xxxx xxxx xxxx xxxx xxxx"** en
   negrita, más los textos legales que correspondan: exención de IVA, inversión del sujeto pasivo o
   criterio de caja. Sin publicidad de ningún tipo.
8. Si la factura ocupa varias páginas, se pone "Página X de Y" y la cabecera de la tabla se repite.

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

### Ventas — Nueva factura emitida

- Migas de pan: `Facturación > Registro de facturas emitidas > Nueva factura`.
- Botones arriba a la derecha: ⋮ · ← · **Nuevo cliente** (alta rápida en un modal, sin salir de la
  factura) · **Crear factura**.
- **Aviso** si el periodo de trabajo está cerrado: "El periodo seleccionado está cerrado, por lo tanto,
  no se podrán insertar nuevas facturas en él. Para crear nuevas facturas debes seleccionar un periodo
  distinto". Debajo, el selector **"Está trabajando en el periodo"** (trimestre).
- **Sección "Información de la factura":**
  - **Cliente\*:** desplegable con buscador.
  - **Número\*:** se rellena solo con el siguiente de la serie. Lleva un enlace **"Obtener número"**
    para recalcularlo.
  - **Serie\*:** p. ej. "Facturas normales", "Rectificativas"…
  - **Fecha\*:** hoy, por defecto.
  - **Fecha de vencimiento:** con botones rápidos **30 días · 60 días · 90 días · Sin fecha**.
  - **Tipo de ingreso ⓘ:** cuenta contable de ventas (p. ej. `700. Venta de mercaderías` o
    `705. Prestaciones de servicios`), con buscador.
  - **Retención ⓘ:** "- Sin retención -", 15 %, 7 %, 19 %… (el valor por defecto depende del cliente y del
    tipo de empresa).
- **Sección "Conceptos":** una fila por concepto con:
  - Concepto (texto multilínea).
  - Base €.
  - Cantidad (con botones − / +; por defecto 1,00).
  - Descuento %.
  - IVA (desplegable: 21 %, 10 %, 4 %, 0 %, exento…).
  - Total de la línea €.
  - Icono de papelera.

  Debajo, **"+ Añadir otro concepto"** y el enlace **"Mostrar edición avanzada"**, que añade más campos
  por línea: producto del catálogo, recargo de equivalencia, suplido, cuenta contable y unidades.
- **Cuatro tarjetas de totales** que se recalculan al escribir: **Subtotal · IVA · Retención · Total**.
- **Sección "Notas":**
  - **Notas en la factura ⓘ:** se elige un texto guardado (con un icono para gestionarlos) o se
    escribe a mano. Sale impresa en la factura.
  - **Notas privadas ⓘ:** solo internas.
  - **Etiquetas:** con el botón ⊕.
- **Sección "Opciones avanzadas":**
  - **Fecha de operación** (si es distinta de la de la factura).
  - **Tipo de operación ⓘ:** "Nacional (si el destinatario tiene el domicilio social en España)",
    Intracomunitaria, Exportación / fuera de la UE, Inversión del sujeto pasivo…
  - Casillas: **Factura emitida en criterio de caja ⓘ** · **Operación de arrendamiento de inmuebles ⓘ** ·
    **Marcar factura como cobrada ⓘ** (registra el cobro a la vez).
- **Sección "Otros"** (plegada): moneda, idioma, varios vencimientos, provisiones de fondos aplicadas
  y documento de origen (presupuesto o albarán). `[PENDIENTE captura de su contenido]`.

### Compras — Nueva factura recibida

- Igual que la emitida, con estas diferencias:
  - Botones: ⋮ · ← · **Nuevo proveedor** · **Crear factura**.
  - Arriba, una **zona para arrastrar el archivo**: "¡Ahorra tiempo! Arrastra aquí tu factura y deja
    que nuestro OCR la contabilice por ti" (máximo 14 MB). Al soltarlo, se rellena el formulario.
  - **Información de la factura:** Proveedor\* · Número\* (texto libre, el del proveedor) · Fecha\* ·
    Fecha de vencimiento (30 / 60 / 90 días / Sin fecha) · **Tipo de gasto** (cuenta 6xx, p. ej.
    `600. Compras de mercaderías (materiales)`, `624. Transportes…`) · **Imputación ⓘ** (% deducible,
    100 por defecto) · Retención ⓘ.
  - **Notas:** solo Notas privadas y Etiquetas.
  - **Opciones avanzadas:** Fecha de operación · Tipo de operación ("Nacional (si el emisor tiene el
    domicilio social en España)"…) · **Imputación a IVA ⓘ** (% del IVA deducible).
  - Casillas: **Factura de un proveedor acogido al régimen de criterio de caja** · Operación de
    arrendamiento de inmuebles · **Marcar factura como pagada**.
  - Sección plegable **"Importar factura electrónica en formato FacturaE"**.
- El archivo adjunto se guarda con la factura y se puede ver y descargar desde el panel de detalle.

### Contactos — Clientes y Proveedores

- Migas de pan: `Clientes y proveedores > Clientes`. Arriba a la derecha: ⚙ y **Nuevo cliente**.
- **"Listado de clientes"** con "Aplicar filtros" (nombre, NIF, población, etiqueta). Columnas:
  **Nombre · NIF · Dirección** (dirección, CP, población, provincia y país en una celda) **· Teléfono ·
  Email · Operaciones**.
- **Menú de Operaciones** (clientes):
  - Ver contacto · Editar contacto · Adjuntar archivos a este cliente · Gestionar etiquetas
  - Ver remesas y recibos girados a este cliente · Descargar vCard · **Copiar como proveedor**
  - Eliminar contacto (solo si no tiene documentos; si los tiene, se archiva)
- **Proveedores:** la misma pantalla. En el menú no aparece la opción de remesas, y "Copiar como
  proveedor" pasa a ser **Copiar como cliente**.
- **"Ver contacto"** abre la ficha con sus datos y pestañas: facturas, presupuestos, cobros o pagos
  pendientes, archivos y notas.

### Contactos — Nuevo cliente / Nuevo proveedor

- Migas de pan: `Clientes y proveedores > Clientes > Nuevo cliente`. Botones: ← · ⚙ · **Crear**.
- **Datos de facturación:** **NIF\*** (validado; si es extranjero, NIF-IVA o identificador del país) y
  **Nombre o razón social\***.
- **Dirección:** Dirección · Código postal · Población · Provincia · País (España por defecto). Enlace
  "Mostrar dirección en el mapa".
- **Secciones plegables:**
  - **Ubicación en el mapa.**
  - **Descuento:** % por defecto en sus facturas.
  - **Datos bancarios:** IBAN, BIC y mandato SEPA (referencia y fecha de firma).
  - **Datos de contacto:** persona, teléfonos, emails (varios, uno marcado para el envío de facturas)
    y web.
  - **Idioma y formato numérico por defecto** para facturas, presupuestos y albaranes (español/inglés;
    `1.234,56` o `1,234.56`).
  - **Otros:** forma de pago y vencimiento por defecto, retención, tipo de operación, cuenta contable,
    etiquetas y notas.
  - **Factura electrónica:** datos de Facturae y centros administrativos DIR3.

### Bancos / Caja — Resumen de tesorería

- Migas de pan: `Bancos / Caja > Resumen`.
- Pestaña **"Cuentas bancarias y de tesorería"**: una tarjeta por cuenta (logo del banco, nombre de la
  cuenta, IBAN abreviado y saldo), la tarjeta **Efectivo** (caja), la tarjeta **+ Nueva cuenta** y la
  tarjeta **⚙ Configuración de cuentas**.
- Pestaña **"Movimientos de los últimos 12 meses"**: gráfico de barras por mes con *Cobros* (verde, hacia
  arriba) y *Pagos* (rojo, hacia abajo).

### Bancos / Caja — Cobros y pagos

- Migas de pan: `Bancos / Caja > Resumen > Cobros y pagos`. Botón **Nuevo cobro / pago manual**.
- **"Listado de cobros y pagos"** con "Aplicar filtros" (fechas, tipo, método, estado de conciliación,
  cuenta). Columnas:
  - **Tipo de documento:** icono que distingue un cobro de factura emitida de un pago de factura recibida.
  - **Documento vinculado:** número de la factura, con enlace.
  - **Fecha.**
  - **Importe:** cobros en verde y positivos; pagos en rojo y negativos.
  - **Método de cobro / pago:** p. ej. "DOMICILIACIÓN" con el IBAN debajo, o "Efectivo"; enlaza a la cuenta.
  - **Estado de la conciliación:** icono rojo (sin conciliar) o verde (conciliado con un movimiento
    del banco).
  - **Operaciones:** Consultar detalles del pago · Consultar documento relacionado · **Conciliar** ·
    Gestionar etiquetas · Eliminar cobro / pago.
- Muestra todo el histórico de la empresa, ordenado por fecha descendente y paginado.

### Ventas / Compras — Cierre de trimestres

- Migas de pan: `Facturación > Cierre de trimestres`.
- **"Selecciona el trimestre a cerrar":**
  - Botones **Cerrar trimestre anterior (2026-3T)** y **Cerrar trimestre actual (2026-4T)**.
  - Bloque **"Cerrar otro trimestre"**: año, trimestre (1T–4T) y el botón **Cerrar trimestre**.
- **"Listado de trimestres cerrados":** columnas **Trimestre · Estado** ("Cerrado" en rojo) **· Fecha de
  cierre** (`dd/mm/aaaa hh:mm:ss`) **· Operaciones** (Reabrir, solo admin, pidiendo el motivo).
- Efecto del cierre: en ese trimestre no se pueden crear, editar ni borrar facturas, gastos, cobros
  ni pagos, y los formularios muestran el aviso de periodo cerrado.

### `[PENDIENTE]` resto de pantallas

PDF de la factura, Catálogo, Gastos, Bienes de inversión, Movimientos y Conciliación, Recibos y
remesas, Impuestos, Informes, Otros y Configuración. Hasta que lleguen sus capturas, seguir los mismos
patrones de listado y formulario.

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

### Impuestos (prioridad máxima)
- **Cálculo de cada modelo** desde las facturas del periodo, con todas sus casillas visibles y el detalle
  de qué facturas suman en cada casilla (clic en la casilla → listado de facturas):
  - **Trimestrales:** 303 (IVA), 130 (IRPF, autónomos), 111 (retenciones de profesionales y nóminas),
    115 (retenciones de alquileres), 349 (intracomunitarias), 202 (pagos fraccionados, sociedades).
  - **Anuales:** 390, 100 (solo los datos de la actividad), 190, 180, 347 y 200 (ayuda con el resultado
    contable).
  - **Mensual** si la empresa está en el régimen mensual (REDEME o grandes empresas): mismo cálculo por mes.
- **Fichero oficial descargable** de cada modelo, con el **diseño de registro publicado por la AEAT** para
  ese ejercicio, listo para "Importar" o "Presentar mediante fichero" en la Sede Electrónica. Debe pasar
  la validación de la AEAT: hay tests con ficheros de ejemplo por modelo y ejercicio.
- **Libros registro** de IVA (expedidas y recibidas) y, para autónomos, de ingresos y gastos (IRPF), en el
  formato estándar de la AEAT (Excel/CSV), para entregar al gestor o atender un requerimiento.
- Al **presentar**, se cierra el trimestre (no se pueden tocar sus facturas) y se guarda el fichero
  generado, la fecha de presentación y el resultado (a ingresar / a devolver / a compensar). La
  cantidad a compensar se arrastra sola al siguiente 303.
- **Calendario fiscal** con los plazos de cada empresa (20 de abril, julio y octubre, 30 de enero…) y aviso
  por email unos días antes, indicando el importe previsto.
- **No se presenta nada automáticamente:** el usuario descarga el fichero y lo sube él mismo (o su gestor).
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
- **Mensajes:** bandeja de **Mensajes recibidos** y **Mensajes enviados** (con + para redactar uno nuevo) entre los usuarios de la empresa, más los avisos del sistema.

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

1. ✅ **Base:** proyecto, login, multiempresa, layout (cabecera, panel lateral, + Crear), Configuración
   (empresa, usuarios, series, tesorería, métodos de pago, plan contable), Contactos (con los 54 de
   Contasimple precargados) y Catálogo.
2. **Ventas:** facturas emitidas, borradores, rectificativas, presupuestos, albaranes, PDF y email.
3. **Compras:** facturas recibidas (con el panel de detalle), gastos, OCR, importar factura y bienes de inversión.
4. **Impuestos:** modelos trimestrales y anuales, **ficheros AEAT**, libros registro, calendario fiscal y
   cierre de trimestres.
5. **Inicio:** página principal completa.
6. **Bancos / Caja:** extractos, conciliación, cobros y pagos, recibos y remesas.
7. **Contabilidad e informes:** asientos automáticos y manuales, diario, mayor, balance y PyG.
8. **Otros y disco virtual:** notas, jornada laboral, correo, mensajes y archivos.
9. **Migración desde Contasimple:** importar **todo el histórico** (hay datos desde 2021): contactos,
   facturas emitidas y recibidas, cobros y pagos, y trimestres cerrados. Después, comprobar que los
   totales por trimestre cuadran con Contasimple.

## Preguntas abiertas

- ¿Qué empresas se darán de alta al principio, y de qué tipo es cada una (autónomo o SL)? (La primera,
  SIMON CABRELLES VENDRELL, autónomo, ya se crea en `/setup`.)
- Última factura emitida en 2026 en Contasimple: 2026-0011 → la serie debe empezar en 12.
- ¿Se cobra por domiciliación SEPA? ¿Con qué bancos se trabaja?
- ¿Quién usará la app, y con qué rol?
