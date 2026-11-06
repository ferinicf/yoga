"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button, Card, Field, Input } from "@/components/ui";
import { toast } from "@/components/toast";

/** Destino del enlace "olvidé mi contraseña": Supabase abre una sesión de recuperación. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (error) return toast(/session/i.test(error.message) ? "El enlace venció. Pide uno nuevo." : error.message, false);
    toast("Contraseña actualizada.");
    router.replace("/");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-md p-5">
        <h1 className="mb-4 text-xl font-semibold">Nueva contraseña</h1>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Contraseña" hint="Mínimo 6 caracteres.">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoComplete="new-password" />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            Guardar
          </Button>
        </form>
      </Card>
    </div>
  );
}
