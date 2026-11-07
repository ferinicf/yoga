"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { enableReminders, isNative, remindersStatus, REMINDERS_ENABLED_EVENT, type RemindersStatus } from "@/lib/native";
import { toast } from "@/components/toast";
import { Button, Card } from "@/components/ui";

/**
 * Mi perfil → Recordatorios de clases (solo en la app de iPhone/Android). Muestra si las
 * notificaciones están activas y, si no, un botón para activarlas: enableReminders() muestra el
 * aviso previo y la solicitud del sistema o, si ya se negó, explica cómo activarlas en Configuración.
 * Con el permiso concedido, <NativeBridge/> programa solo los recordatorios de las clases reservadas.
 */
export function RemindersSetting({ titleClassName = "mb-3 font-semibold" }: { titleClassName?: string }) {
  const [status, setStatus] = useState<RemindersStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNative()) return;
    let alive = true;
    const check = () => {
      remindersStatus()
        .then((s) => alive && setStatus(s))
        .catch(() => {});
    };
    check();
    // Al volver de Configuración o cuando se concede el permiso desde otra pantalla (al reservar).
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(REMINDERS_ENABLED_EVENT, check);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(REMINDERS_ENABLED_EVENT, check);
    };
  }, []);

  if (!status || status === "web") return null;

  const on = status === "granted";

  const activate = async () => {
    setBusy(true);
    const next = await enableReminders();
    setBusy(false);
    setStatus(next);
    if (next === "granted") toast("Listo: te avisaremos 1 hora antes de cada clase.");
  };

  return (
    <section aria-labelledby="recordatorios-titulo">
      <h2 id="recordatorios-titulo" className={titleClassName}>
        Recordatorios de clases
      </h2>
      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {on ? (
            <Bell size={20} className="mt-0.5 shrink-0 text-brand-text" aria-hidden />
          ) : (
            <BellOff size={20} className="mt-0.5 shrink-0 text-muted" aria-hidden />
          )}
          <div className="min-w-0 text-sm">
            <p className="font-medium">{on ? "Activados" : "Desactivados"}</p>
            <p className="text-muted">
              {on
                ? "Te avisamos en este teléfono 1 hora antes de cada clase que reserves. Para quitarlos, entra a la configuración de tu teléfono → Marea → Notificaciones."
                : "Actívalos para recibir un aviso en este teléfono 1 hora antes de cada clase que reserves."}
            </p>
          </div>
        </div>
        {!on && (
          <Button type="button" variant="outline" className="shrink-0" disabled={busy} onClick={activate}>
            <Bell size={16} aria-hidden /> Activar recordatorios
          </Button>
        )}
      </Card>
    </section>
  );
}
