"use client";

import { X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn, initials } from "@/lib/utils";
import { ModalToasts, useOpenModals } from "./toast";

/* ---------- Botón ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

/**
 * Clases de botón, también para enlaces (<a>/<Link>) que se ven como botón.
 * Todos los tamaños miden al menos 40 px de alto (objetivo táctil en celular y iPad).
 */
export function buttonClass({ variant = "primary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    size === "sm" && "h-10 px-3 text-sm",
    size === "md" && "h-11 px-4 text-sm",
    size === "lg" && "h-12 px-5 text-base",
    variant === "primary" && "bg-brand text-brand-ink hover:brightness-95",
    variant === "secondary" && "bg-brand-soft text-brand-strong hover:brightness-95",
    variant === "outline" && "border border-line bg-surface hover:bg-bg",
    variant === "ghost" && "hover:bg-black/5",
    variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={buttonClass({ variant, size, className })} />;
}

/** Enlace de texto con área táctil de al menos 40 px de alto (sin cambiar cómo se ve). */
export const textLinkClass = "inline-flex min-h-10 items-center";

/* ---------- Tarjeta ---------- */
export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn("rounded-2xl border border-line bg-surface", className)}>
      {children}
    </div>
  );
}

/* ---------- Badge ---------- */
const BADGE: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  gray: "bg-stone-100 text-stone-600 ring-stone-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  brand: "bg-brand-soft text-brand-strong ring-transparent",
};
export function Badge({ tone = "gray", children, className }: { tone?: keyof typeof BADGE; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", BADGE[tone], className)}>
      {children}
    </span>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* ---------- Formularios ---------- */
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 h-11 text-[16px] md:text-sm outline-none focus:ring-2 ring-brand focus:border-transparent";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "h-auto min-h-24 py-2", props.className)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, "pr-8", props.className)} />;
}

/** Atributos para un campo de teléfono: teclado telefónico y validación nativa del formato. */
export const phoneInputProps = {
  type: "tel",
  inputMode: "tel",
  autoComplete: "tel",
  maxLength: 20,
  pattern: "[0-9 +\\(\\)\\-]{10,20}",
  title: "Escribe un teléfono de 10 dígitos (puedes usar espacios, guiones o +52).",
} as const;

/** Valida un teléfono opcional (misma regla que el guardado en el demo y en la base). */
export { phoneError } from "@/lib/rules";

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-4 py-2 text-left"
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-stone-300")}>
        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}

/* ---------- Modal: hoja inferior en celular, diálogo centrado en iPad/escritorio ---------- */

/** Cuántos modales hay abiertos: el Toaster se acomoda para no tapar su pie ni sus botones. */
export { useOpenModals };

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  useEffect(() => {
    if (!open) return;
    useOpenModals.setState((s) => ({ count: s.count + 1 }));
    return () => useOpenModals.setState((s) => ({ count: Math.max(0, s.count - 1) }));
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          "animate-sheet relative flex max-h-[92dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-3xl bg-surface shadow-xl md:rounded-3xl",
          wide ? "md:max-w-3xl" : "md:max-w-lg",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-my-1 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <ModalToasts />
        {/* En celular la hoja llega al borde inferior: el área segura se suma al padding. */}
        <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pt-4", footer ? "pb-4" : "pb-safe-4 md:pb-4")}>{children}</div>
        {footer && <div className="shrink-0 border-t border-line bg-surface px-5 pb-safe-3 pt-3 md:pb-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Varios ---------- */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Occupancy({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2" title={`${value} de ${max} lugares`}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
        <div className={cn("h-full rounded-full", pct >= 100 ? "bg-amber-500" : "bg-brand")} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted">
        {value}/{max}
      </span>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-stone-200/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-10 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition",
            value === o.value ? "bg-surface shadow-sm" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
