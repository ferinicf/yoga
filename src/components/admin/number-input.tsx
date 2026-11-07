"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max"> & {
  /** Con `allowEmpty`, NaN = campo vacío. */
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** Al salir del campo, ajusta el valor al rango [min, max]. Si no, la validación queda para el guardado. */
  clamp?: boolean;
  /** Permite decimales (por omisión se redondea a entero). */
  decimals?: boolean;
  /**
   * Si el campo se vacía, avisa al formulario con NaN (y lo deja vacío) en lugar de volver al
   * último valor válido. El formulario debe tratar NaN como inválido (p. ej. `!(v > 0)`).
   */
  allowEmpty?: boolean;
};

/**
 * Campo numérico que deja borrar y reescribir: mientras se edita guarda el texto tal cual
 * y avisa al formulario cada vez que hay un número; al salir del campo lo convierte
 * (y lo ajusta al rango si `clamp`). Si queda vacío, vuelve al último valor válido, salvo con
 * `allowEmpty` (entonces el formulario recibe NaN y lo marca como inválido).
 */
export function NumberInput({ value, onChange, min, max, clamp, decimals, allowEmpty, onFocus, onBlur, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = Number.isNaN(value) ? "" : String(value);

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
      value={draft ?? shown}
      onFocus={(e) => {
        setDraft(shown);
        onFocus?.(e);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parse(e.target.value);
        if (n !== null) onChange(n);
        else if (allowEmpty) onChange(NaN);
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
