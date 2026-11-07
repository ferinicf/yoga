"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { CircleCheck, CircleX, Clock } from "lucide-react";
import { useCurrentUser, useSettings, useStore } from "@/lib/store";
import { buttonClass, Card } from "@/components/ui";

/**
 * Regreso del pago en línea: /pago?estado=aprobado|pendiente|rechazado.
 * En la app llega por el enlace profundo marea://pago?estado=… (el pago se abre en el navegador del
 * sistema y, al terminar, Mercado Pago regresa aquí). En la web, por sus back_urls.
 * También entiende los parámetros que agrega Mercado Pago (status / collection_status).
 * Esta pantalla solo informa: el paquete lo activa el servidor cuando Mercado Pago confirma el pago.
 */
type Estado = "aprobado" | "pendiente" | "rechazado" | "otro";

const ESTADOS: Record<string, Estado> = {
  aprobado: "aprobado",
  approved: "aprobado",
  pendiente: "pendiente",
  pending: "pendiente",
  in_process: "pendiente",
  rechazado: "rechazado",
  rejected: "rechazado",
  cancelled: "rechazado",
};

const TEXTO: Record<Estado, { title: string; text: string }> = {
  aprobado: {
    title: "¡Pago recibido!",
    text: "Gracias. Tu paquete se activa en cuanto Mercado Pago confirme el pago; suele tardar unos segundos.",
  },
  pendiente: {
    title: "Tu pago está en proceso",
    text: "Mercado Pago todavía lo está revisando. Tu paquete se activará solo cuando el pago se acredite.",
  },
  rechazado: {
    title: "No se completó el pago",
    text: "No se hizo ningún cargo. Puedes intentarlo de nuevo o pagar en recepción.",
  },
  otro: {
    title: "Regresaste del pago",
    text: "Si completaste el pago, tu paquete aparecerá en Paquetes en unos momentos.",
  },
};

export default function PaymentReturnPage() {
  // useSearchParams necesita un límite de Suspense para que la página se pueda exportar (app de iOS/Android).
  return (
    <Suspense>
      <PaymentReturn />
    </Suspense>
  );
}

function PaymentReturn() {
  const params = useSearchParams();
  const user = useCurrentUser();
  const settings = useSettings();
  const raw = (params.get("estado") ?? params.get("status") ?? params.get("collection_status") ?? "").toLowerCase();
  const estado = ESTADOS[raw] ?? "otro";
  const { title, text } = TEXTO[estado];
  const Icon = estado === "aprobado" ? CircleCheck : estado === "rechazado" ? CircleX : Clock;

  // Datos al día (paquetes y créditos); si se aprobó, otra vez al rato por si la confirmación tarda.
  useEffect(() => {
    const refresh = () => useStore.getState().refresh().catch(() => {});
    refresh();
    if (estado !== "aprobado") return;
    const t = setTimeout(refresh, 5000);
    return () => clearTimeout(t);
  }, [estado]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 pb-safe-10 pt-safe-10">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-2xl font-semibold tracking-tight">{settings.studioName}</p>
        <Card className="p-6 text-center">
          <Icon
            size={44}
            className={`mx-auto mb-3 ${estado === "aprobado" ? "text-emerald-600" : estado === "rechazado" ? "text-red-600" : "text-amber-600"}`}
            aria-hidden
          />
          <h1 className="mb-2 text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted">{text}</p>
          <div className="mt-6 grid gap-2">
            {user?.role === "student" ? (
              <>
                <Link href="/alumno/paquetes" className={buttonClass({ size: "lg", className: "w-full" })}>
                  Ver mis paquetes
                </Link>
                <Link href="/alumno" className={buttonClass({ variant: "outline", size: "lg", className: "w-full" })}>
                  Ir al inicio
                </Link>
              </>
            ) : (
              <Link href="/" className={buttonClass({ size: "lg", className: "w-full" })}>
                {user ? "Ir al inicio" : "Iniciar sesión"}
              </Link>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
