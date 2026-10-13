# Cuadro de Mandos Bocubi

App web de control semanal de gestión de **Bocubi**. Sustituye al Excel *Cuadro_de_Mandos_Semanal_Ventas.xlsx*.

**Qué incluye**
- **Dashboard semanal** con semáforos (Bien / Alerta / Mal), comparación con la semana anterior y con el año anterior, tendencia de 12 semanas, acumulado del año y previsión de cierre.
- **Vistas por área:** Ventas, Presupuestos, Marketing y Leads, Operaciones (con carga de fábrica) y Calidad.
- **Análisis semanal:** la app obliga a que cada KPI en Alerta o Mal tenga un comentario y una acción.
- **Plan de acción** con tablero, responsables, fechas límite y avisos de acciones vencidas.
- **Modo reunión** y acta en PDF.
- **Resumen** mensual, trimestral y anual, exportable a Excel.
- **Datos semanales** editables como en el Excel, con historial de cambios.
- **Importación de Excel** con previsualización.
- **Avisos por email**, **resumen ejecutivo con IA**, **usuarios con roles**.

---

## Puesta en marcha en Vercel (paso a paso)

### 1. Crear el proyecto
1. Entra en [vercel.com](https://vercel.com) → **Add New… → Project**.
2. Importa el repositorio de GitHub **CUADRO-DE-MANDOS-**.
3. No cambies nada de la configuración de compilación: Vercel detecta Next.js solo.

### 2. Conectar la base de datos (gratis)
1. Dentro del proyecto, ve a **Storage → Create Database → Neon (Postgres)**.
2. Elige el plan gratuito y la región **Frankfurt (eu-central-1)**.
3. Pulsa **Connect** al proyecto, marcando Production y Preview.

Vercel crea solo la variable `DATABASE_URL`. La primera vez que abras la app se crean las tablas y se cargan los datos históricos del Excel (semanas 17 a 41 de 2026).

### 3. Variables de entorno
En **Settings → Environment Variables** añade estas variables:

| Variable | Valor | ¿Obligatoria? |
|---|---|---|
| `AUTH_SECRET` | Una cadena aleatoria larga (por ejemplo, el resultado de `openssl rand -base64 32`). Si no existe, se deriva de la URL de la base de datos | Recomendada |
| `SETUP_CODE` | Un código que tú elijas; se pide al crear el primer administrador. Si no existe, el primero que entra crea el administrador | Recomendada |
| `CRON_SECRET` | Otra cadena aleatoria; sin ella los avisos programados no se ejecutan | Para los emails automáticos |
| `APP_URL` | La URL de la app, por ejemplo `https://cuadro-de-mandos-bocubi.vercel.app` | Recomendada |
| `RESEND_API_KEY` | Clave de [resend.com](https://resend.com), para enviar emails | Opcional |
| `EMAIL_FROM` | Remitente, por ejemplo `Cuadro de Mandos Bocubi <kpi@bocubi.com>`. El dominio tiene que estar verificado en Resend | Opcional |
| `ANTHROPIC_API_KEY` | Clave de [console.anthropic.com](https://console.anthropic.com), para el resumen con IA | Opcional |

Después ve a **Deployments → … → Redeploy**.

### 4. Crear el primer administrador
1. Abre la URL de la app. Te llevará a **Puesta en marcha**.
2. Introduce tu nombre, tu email, una contraseña y el `SETUP_CODE`.
3. Ve a **Usuarios** y crea a Verónica (Editor), Borja y Mónica (Dirección). La app genera una contraseña temporal para cada uno; si Resend está configurado, también se la envía por email.

### 5. Dominio propio (opcional)
En **Settings → Domains** añade, por ejemplo, `kpi.bocubi.com` y sigue las instrucciones de DNS.

---

## Uso semanal (5–10 minutos)

1. **Lunes por la mañana**
   - Verónica carga la semana anterior, de una de estas dos formas:
     - **Importar** → sube el Excel.
     - **Datos** → edita las celdas.
   - La app avisa por email si faltan datos.
2. **Antes de la reunión**
   - En **Análisis**, cada KPI en rojo o ámbar lleva su causa y una acción.
   - Opcional: pulsa **Generar** en el resumen con IA.
3. **Reunión**
   - En **Reunión**, recorre las áreas en orden.
   - Crea acciones y guarda el acta.
   - Pulsa **Acta PDF** o **Enviar resumen**.
4. **Durante la semana**
   - Cada responsable mueve sus acciones a *En curso* o *Hecha* en **Acciones**.

### Roles
- **Administrador:** puede hacer todo, incluidos los usuarios y la configuración.
- **Dirección:** ve todo, comenta, gestiona acciones y dirige la reunión.
- **Editor:** carga e importa datos, comenta y crea acciones.
- **Lector:** solo lectura.

---

## Cambios respecto al Excel original

1. **"Pedidos servidos" en el dashboard:** ahora muestra los € servidos. Antes mostraba por error el % de incidencias.
2. **Objetivo de ventas:** hay uno solo, 46.500 €/semana, editable en Configuración.
3. **Objetivo de pedidos atrasados:** 5.000 € de forma provisional (en el Excel ponía 5). Aparece en Configuración como *pendiente de confirmar*.
4. **% fuera de plazo:** se calcula sobre los pedidos servidos, no sobre los pendientes.
5. **Ticket medio:** se separa en "Ticket medio venta" y "Valor medio pedido pendiente".
6. **Ventas año anterior:**
   - Si existe la misma semana del año anterior, se toma automáticamente.
   - La comparación solo usa semanas que tienen dato en los dos años.
7. **Cálculos:** se hacen en código, así que ya no hay fórmulas rotas ni gráficos con `#REF!`.
8. **Mes de cada semana:** se calcula automáticamente (el mes del jueves de esa semana).
9. **Semanas cerradas (vacaciones):** no penalizan ni semáforos ni medias.
10. **Datos vacíos:** se muestra "Sin dato" en lugar de 0. Cada semana tiene un indicador de cuánto se ha rellenado.

---

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000 — base de datos local automática en .data/
npm test
```

Para mejorar la app con Claude Code, consulta [`CLAUDE.md`](./CLAUDE.md): explica dónde se cambia cada cosa.
