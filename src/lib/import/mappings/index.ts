// ★ Mapeos de importación. Para soportar un archivo nuevo, crea un archivo en esta carpeta
// (copia excel-original.ts como modelo) y añádelo a la lista. Se usa el primero que reconozca el archivo.

import { excelOriginal } from "./excel-original";
import { plantillaBocubi } from "./plantilla-bocubi";
import type { Mapping } from "./types";

export const MAPPINGS: Mapping[] = [plantillaBocubi, excelOriginal];

export type { Mapping } from "./types";
