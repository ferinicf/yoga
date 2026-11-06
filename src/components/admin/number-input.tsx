"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max"> & {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** Al salir del campo, ajusta el valor al rango [min, max]. Si no, la validación queda para el guardado. */
  clamp?: boolean;
  /** Permite decimales (por omisión se redondea a entero). */
  decimals?: boolean;
};

/**
 * Campo numérico que deja borrar y reescribir: mientras se edita guarda el texto tal cual
 * y solo avisa al formulario cuando hay un número; al salir del campo lo convierte
 * (y lo ajusta al rango si `clamp`). Si queda vacío, vuelve al último valor válido.
 */
export function NumberInput({ value, onChange, min, max, clamp, decimals, onFocus, onBlur, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  const parse = (raw: string): number | null => {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return decimals ? n : Math.round(n);
  };

  return (
    <Input
      {...rest}
      type="number"
      inputMode={decimals ? "decimal" : "numeric"}
      min={min}
      max={max}
      value={draft ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value));
        onFocus?.(e);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parse(e.target.value);
        if (n !== null) onChange(n);
      }}
      onBlur={(e) => {
        const n = draft === null ? null : parse(draft);
        if (n !== null && clamp) {
          const c = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
          if (c !== value) onChange(c);
        }
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}
