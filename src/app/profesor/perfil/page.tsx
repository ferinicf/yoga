"use client";

import { useState } from "react";
import { startOfMonth } from "date-fns";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import { toast, toastResult } from "@/components/toast";
import { Avatar, Button, Card, Field, Input, PageHeader, Textarea, phoneError, phoneInputProps } from "@/components/ui";

export default function TeacherProfile() {
  const db = useDB();
  const user = useCurrentUser()!;
  const upsertUser = useStore((s) => s.upsertUser);
  // En modo real el correo es el de la cuenta (inicio de sesión): aquí no se cambia.
  const isLive = useStore((s) => s.mode) === "live";
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone, bio: user.bio ?? "" });
  const [busy, setBusy] = useState(false);
  const now = new Date();

  // Mismas validaciones que el alta de personas del admin (nombre, formato y correo único).
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
    const next = { name, email, phone: form.phone.trim(), bio: form.bio.trim() };
    setBusy(true);
    const r = await toastResult(upsertUser({ ...user, ...next, bio: next.bio || undefined }));
    setBusy(false);
    if (r.ok) setForm(next);
  };

  const monthSessions = db.sessions.filter(
    (s) => s.teacherId === user.id && s.status !== "cancelled" && new Date(s.startsAt) >= startOfMonth(now) && new Date(s.startsAt) <= now,
  );
  const attended = db.reservations.filter(
    (r) => r.status === "attended" && monthSessions.some((s) => s.id === r.sessionId),
  ).length;
  const avg = monthSessions.length ? (attended / monthSessions.length).toFixed(1) : "0";

  const stats = [
    { label: "Clases impartidas este mes", value: monthSessions.length },
    { label: "Asistencias este mes", value: attended },
    { label: "Promedio de alumnos por clase", value: avg },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Mi perfil" />
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={user.name} color={user.color} size={64} />
          <div>
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-muted">Profesor/a</p>
          </div>
        </div>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
          <Field label="Nombre">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Correo" hint={isLive ? "Es el correo con el que inicias sesión. Para cambiarlo, pídelo en recepción." : undefined}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              readOnly={isLive}
              autoComplete="email"
              className={isLive ? "bg-bg text-muted" : undefined}
            />
          </Field>
          <Field label="Teléfono">
            <Input {...phoneInputProps} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Biografía (la ven los alumnos al reservar)" className="md:col-span-2">
            <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </Field>
          <div>
            <Button type="submit" disabled={busy}>
              Guardar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
