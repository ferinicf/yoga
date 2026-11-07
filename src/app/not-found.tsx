import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_PATH, STUDIO_NAME } from "@/lib/legal";
import { HomeButton } from "@/components/public-page";

/**
 * Página no encontrada (cualquier dirección que no existe, en la web y en el export estático: out/404.html).
 * Dentro de la app casi no se ve: el WebView devuelve index.html y la app reenvía a la pantalla correcta.
 */
export const metadata: Metadata = {
  title: `Página no encontrada · ${STUDIO_NAME}`,
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 pb-safe-10 pt-safe-10">
      <div className="w-full max-w-md text-center">
        <span
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-2xl font-bold text-brand-ink"
          aria-hidden
        >
          {STUDIO_NAME.charAt(0)}
        </span>
        <p className="text-sm font-medium text-muted">Error 404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">No encontramos esta página</h1>
        <p className="mt-2 text-sm text-muted">Puede que el enlace esté incompleto o que la página ya no exista.</p>
        <div className="mt-6">
          <HomeButton />
        </div>
        <p className="mt-4 text-sm text-muted">
          ¿Necesitas ayuda?{" "}
          <Link href={SUPPORT_PATH} className="inline-flex min-h-10 items-center px-1 font-medium text-brand-text underline">
            Escríbenos
          </Link>
        </p>
      </div>
    </div>
  );
}
