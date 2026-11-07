"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import { toast, toastResult } from "@/components/toast";
import { DeleteAccount, PrivacyLink } from "@/components/delete-account";
import { Avatar, Button, Card, Field, Input, PageHeader, phoneError, phoneInputProps } from "@/components/ui";

/**
 * Admin → Mi cuenta: los datos de la propia cuenta de quien administra, el aviso de privacidad y
 * eliminar la cuenta (App Store 5.1.1(v)). Está en el menú, no en la barra inferior del celular.
 */
export default function AdminAccountPage() {
  const db = useDB();
  const user = useCurrentUser()!;
  const upsertUser = useStore((s) => s.upsertUser);
  const logout = useStore((s) => s.logout);
  // En modo real el correo es el del inicio de sesión: aquí no se cambia.
  const isLive = useStore((s) => s.mode) === "live";
  const router = useRouter();
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone });
  const [busy, setBusy] = useState(false);

  // Mismas validaciones que Mi perfil del profesor y el alta de personas.
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim().replace(/\s+/g, " ");
    if (!name) return toast("Escribe tu nombre.", false);
    const email = isLive ? user.email : form.email.trim().toLowerCase();
    if (!isLive) {
      if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Escribe un correo válido.", false);
      if (db.users.some((u) => u.id !== user.id && u.email.trim().toLowerCase() === email))
        return toast("Ya existe una persona con ese correo.", false);
    }
    const phoneMsg = phoneError(form.phone);
    if (phoneMsg) return toast(phoneMsg, false);
    const next = { name, email, phone: form.phone.trim() };
    setBusy(true);
    const r = await toastResult(upsertUser({ ...user, ...next }));
    setBusy(false);
    if (r.ok) setForm(next);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Mi cuenta" subtitle="Tus datos de acceso al panel de administración." />
      <Card className="p-5">
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={user.name} color={user.color} size={64} />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-muted">Administración</p>
          </div>
        </div>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
          <Field label="Nombre">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoComplete="name" />
          </Field>
          <Field label="Correo" hint={isLive ? "Es el correo con el que inicias sesión." : undefined}>
            <Input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              readOnly={isLive}
              className={isLive ? "bg-bg text-muted" : undefined}
            />
          </Field>
          <Field label="Teléfono">
            <Input {...phoneInputProps} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <div className="flex flex-wrap items-end gap-2 md:col-span-2">
            <Button type="submit" disabled={busy}>
              Guardar cambios
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await logout();
                router.replace("/");
              }}
            >
              <LogOut size={16} aria-hidden /> Cerrar sesión
            </Button>
          </div>
        </form>
      </Card>

      <PrivacyLink />
      <DeleteAccount />
    </div>
  );
}
