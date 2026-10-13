// Áreas de la empresa: orden en menús, reunión semanal y responsables por defecto.
// Los responsables se pueden cambiar desde Configuración (esto es solo el valor inicial).

export type AreaKey = "ventas" | "presupuestos" | "marketing" | "operaciones" | "calidad";

export const AREAS: { key: AreaKey; label: string; description: string; defaultOwner: string }[] = [
  { key: "ventas", label: "Ventas", description: "Entrada de pedidos, ticket medio y comparación con objetivo y año anterior.", defaultOwner: "Verónica" },
  { key: "presupuestos", label: "Presupuestos", description: "Pipeline comercial: presupuestos enviados y confirmados.", defaultOwner: "Verónica" },
  { key: "marketing", label: "Marketing y Leads", description: "Generación de leads, coste, contacto y conversión a venta.", defaultOwner: "Rafa / Verónica / Sheila" },
  { key: "operaciones", label: "Operaciones", description: "Pedidos servidos, plazos, cartera pendiente y carga de fábrica.", defaultOwner: "Manolo / Juan" },
  { key: "calidad", label: "Calidad", description: "Incidencias sobre pedidos y su resolución en plazo.", defaultOwner: "Manolo / Juan" },
];

export const AREA_BY_KEY = Object.fromEntries(AREAS.map((a) => [a.key, a])) as Record<AreaKey, (typeof AREAS)[number]>;
