"use client";

import { useState } from "react";
import { startOfMonth } from "date-fns";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import { toastResult } from "@/components/toast";
import { Avatar, Button, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";

export default function TeacherProfile() {
  const db = useDB();
  const user = useCurrentUser()!;
  const upsertUser = useStore((s) => s.upsertUser);
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone, bio: user.bio ?? "" });
  const now = new Date();

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
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            toastResult(upsertUser({ ...user, ...form }));
          }}
        >
          <Field label="Nombre">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Correo">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Teléfono">
            <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Biografía (la ven los alumnos al reservar)" className="md:col-span-2">
            <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </Field>
          <div>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
