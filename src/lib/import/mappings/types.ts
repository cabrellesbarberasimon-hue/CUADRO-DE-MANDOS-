import type { Sheet } from "../workbook";
import type { WeekInput } from "@/lib/data";

export type ImportIssue = { row: number; message: string };

export type Mapping = {
  id: string;
  label: string;
  description: string;
  /** ¿Reconoce este archivo? */
  detect: (sheets: Sheet[]) => boolean;
  /** Convierte el archivo en semanas. `defaultYear` se usa si el archivo no indica el año. */
  map: (sheets: Sheet[], defaultYear: number) => { rows: WeekInput[]; issues: ImportIssue[] };
};
