// ★ Novedades visibles en la app (menú usuario → Novedades). Añade la entrada más reciente ARRIBA.
// Escribe en lenguaje de negocio: qué cambia para quien usa la app.

export const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  {
    version: "1.0.1",
    date: "2026-10-13",
    items: [
      "La app se pone en marcha en Vercel solo con la base de datos conectada (sin variables adicionales obligatorias).",
      "Corregido: la configuración (capacidad de fábrica, umbrales, responsables, destinatarios) se guardaba como texto en Postgres.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-13",
    items: [
      "Primera versión del Cuadro de Mandos Bocubi, que sustituye al Excel semanal.",
      "Dashboard semanal con semáforos, comparación con semana y año anterior, tendencia de 12 semanas, acumulado del año y previsión de cierre.",
      "Vistas por área: Ventas, Presupuestos, Marketing y Leads, Operaciones y Calidad.",
      "Análisis semanal: cada KPI en Alerta/Mal exige comentario y acción (regla clave del Excel).",
      "Plan de acción con tablero, responsables, vencimientos y % de acciones cerradas en plazo.",
      "Modo reunión con acta imprimible en PDF y envío del resumen por email.",
      "Resumen mensual, trimestral y anual con exportación a Excel.",
      "Importación de Excel con previsualización de cambios e historial. Exportación de datos como plantilla reimportable.",
      "Correcciones respecto al Excel: pedidos servidos del dashboard, objetivo de ventas único, % fuera de plazo sobre pedidos servidos, ticket medio renombrado, ventas año anterior automáticas, mes calculado por semana ISO, semanas cerradas (agosto) excluidas, 'Sin dato' en lugar de 0.",
      "Avisos por email (resumen del lunes, KPIs en rojo, recordatorio de carga, acciones vencidas) y resumen ejecutivo con IA.",
      "Usuarios con roles (administrador, dirección, editor, lector) e historial de cambios de cada dato.",
    ],
  },
];
