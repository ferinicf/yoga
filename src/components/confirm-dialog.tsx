"use client";

import { useEffect, useId, useRef } from "react";
import { create } from "zustand";
import { Button, Modal } from "./ui";

/**
 * Diálogo de confirmación propio, en español, para no usar window.confirm(): dentro de la app de
 * iOS/Android ese diálogo lo dibuja Capacitor con botones fijos en inglés ("Cancel" / "Ok").
 *
 *   if (!(await confirmar({ title: "¿Eliminar Salón Sol?", confirmText: "Eliminar salón", destructive: true }))) return;
 *
 * Se dibuja con el <Modal> de la app (hoja inferior en celular, diálogo centrado en iPad/escritorio)
 * y se monta una sola vez en <Providers> con <ConfirmHost/>. Si se piden varios a la vez, salen en orden.
 */
export interface ConfirmOptions {
  /** Pregunta o encabezado, p. ej. "¿Cancelar esta clase?". */
  title: string;
  /** Explicación de lo que va a pasar. Acepta saltos de línea. */
  message?: string;
  /** Texto del botón que confirma. Mejor un verbo claro: "Eliminar salón", "Reembolsar"… */
  confirmText?: string;
  /** Texto del botón que no hace nada. null = sin ese botón (aviso con un solo botón). */
  cancelText?: string | null;
  /** Acción que borra o no se puede deshacer: botón rojo y el foco empieza en "No, volver". */
  destructive?: boolean;
}

interface Request extends ConfirmOptions {
  id: number;
  resolve: (ok: boolean) => void;
}

const useConfirmQueue = create<{ queue: Request[] }>(() => ({ queue: [] }));

let seq = 0;

/** Responde una pregunta y la quita de la fila (si se toca dos veces, la segunda no hace nada). */
function settle(req: Request, ok: boolean) {
  useConfirmQueue.setState((s) => ({ queue: s.queue.filter((r) => r.id !== req.id) }));
  req.resolve(ok);
}

/**
 * Pregunta antes de una acción. Resuelve true solo si se toca el botón de confirmar; cerrar con la X,
 * tocar fuera, la tecla Escape o el botón "atrás" de Android cuentan como "no".
 */
export function confirmar(opts: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  // Se forma en la fila; <ConfirmHost/> (montado desde el arranque en <Providers>) la muestra. Nunca
  // se usa el diálogo de la plataforma.
  return new Promise((resolve) => {
    useConfirmQueue.setState((s) => ({ queue: [...s.queue, { ...opts, id: ++seq, resolve }] }));
  });
}

/** Aviso con un solo botón (por omisión "Entendido"). Resuelve al cerrarlo, de cualquier forma. */
export async function avisar(opts: { title: string; message?: string; confirmText?: string }): Promise<void> {
  await confirmar({ confirmText: "Entendido", ...opts, cancelText: null });
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Dibuja el diálogo pendiente. Va una vez, después del contenido de la app (queda encima de otros modales). */
export function ConfirmHost() {
  const current = useConfirmQueue((s) => s.queue[0]);
  const box = useRef<HTMLDivElement>(null);
  const messageId = useId();

  useEffect(() => {
    if (!current) return;
    const dialog = () => box.current?.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]') ?? null;

    // Accesibilidad: es una pregunta (alertdialog) y el texto la describe.
    const el = dialog();
    if (el) {
      el.setAttribute("role", "alertdialog");
      if (current.message) el.setAttribute("aria-describedby", messageId);
    }

    // El foco entra al diálogo: en acciones destructivas, en "No, volver"; si no, en el botón principal.
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    // Escape cierra solo este diálogo (no la ventana que está debajo) y Tab no se sale de él.
    // Se escucha en captura para ganarle al Escape del <Modal> de abajo.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        settle(current, false);
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialog();
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!root.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      // Al cerrar, el foco regresa a donde estaba (si ese elemento sigue en pantalla).
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [current, messageId]);

  if (!current) return null;
  const answer = (ok: boolean) => settle(current, ok);
  const cancelText = current.cancelText === undefined ? "No, volver" : current.cancelText;
  const focusCancel = !!current.destructive && cancelText !== null;

  return (
    // z-[55]: por encima de los demás modales (z-50) y del menú lateral.
    <div ref={box} className="relative z-[55]">
      <Modal
        key={current.id}
        open
        onClose={() => answer(false)}
        title={current.title}
        footer={
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            {cancelText !== null && (
              <Button
                variant="outline"
                size="lg"
                className="w-full md:w-auto"
                data-autofocus={focusCancel || undefined}
                onClick={() => answer(false)}
              >
                {cancelText}
              </Button>
            )}
            <Button
              variant={current.destructive ? "danger" : "primary"}
              size="lg"
              className="w-full md:w-auto"
              data-autofocus={!focusCancel || undefined}
              onClick={() => answer(true)}
            >
              {current.confirmText ?? "Aceptar"}
            </Button>
          </div>
        }
      >
        {current.message ? (
          <p id={messageId} className="whitespace-pre-line text-[15px] leading-relaxed text-muted">
            {current.message}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
