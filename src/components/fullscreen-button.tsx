"use client";

import { Maximize } from "lucide-react";
import { Button } from "./ui";

export function FullscreenButton() {
  return (
    <Button variant="ghost" type="button" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>
      <Maximize size={16} /> Pantalla completa
    </Button>
  );
}

export function PrintButton({ label = "Imprimir / Guardar PDF" }: { label?: string }) {
  return (
    <Button type="button" onClick={() => window.print()} className="no-print">
      {label}
    </Button>
  );
}
