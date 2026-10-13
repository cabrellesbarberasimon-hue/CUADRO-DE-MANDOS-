// Colores de gráficos (validados para daltonismo sobre fondo blanco).
// Los tokens de interfaz están en src/app/globals.css (@theme).

export const CHART = {
  actual: "#A65F27", // nogal cálido: valor real
  prevYear: "#3C6FB0", // azul: año anterior
  target: "#1A1A1A", // línea discontinua: objetivo
  grid: "#E4E1DB",
  axis: "#6B6B6B",
  band: "#3F7D58", // banda objetivo (rango)
  closed: "#EFEDE9", // semanas cerradas
};

export const STATUS_COLORS = {
  bien: { fg: "#3F7D58", bg: "#E7F1EA" },
  alerta: { fg: "#A87A17", bg: "#F8EFD9" },
  mal: { fg: "#B4432F", bg: "#F6E3DF" },
  sin_dato: { fg: "#8A8781", bg: "#EFEDE9" },
  cerrada: { fg: "#8A8781", bg: "#EFEDE9" },
  info: { fg: "#6B6B6B", bg: "#F4F2EE" },
} as const;
