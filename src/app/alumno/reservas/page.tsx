"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { useCurrentUser, useDB } from "@/lib/store";
import type { Session } from "@/lib/types";
import { fmt } from "@/lib/utils";
import { BookingSheet, ReservationStatusBadge } from "@/components/domain";
import { Button, Card, Empty, PageHeader, Segmented } from "@/components/ui";

export default function MyReservations() {
  const db = useDB();
  const user = useCurrentUser()!;
  const router = useRouter();
  const [tab, setTab] = useState<"next" | "past">("next");
  const [open, setOpen] = useState<Session | null>(null);
  const now = new Date();

  const rows = db.reservations
    .filter((r) => r.userId === user.id)
    .map((r) => ({ r, s: db.sessions.find((s) => s.id === r.sessionId)! }))
    .filter(({ s }) => !!s);

  // Próximas: toda reservación vigente de una clase que no ha empezado (también con check-in anticipado).
  const next = rows
    .filter(({ r, s }) => new Date(s.startsAt) > now && r.status !== "cancelled")
    .sort((a, b) => +new Date(a.s.startsAt) - +new Date(b.s.startsAt));
  const past = rows
    .filter(({ r, s }) => new Date(s.startsAt) <= now || r.status === "cancelled")
    .sort((a, b) => +new Date(b.s.startsAt) - +new Date(a.s.startsAt));
  const list = tab === "next" ? next : past;

  return (
    <div>
      <PageHeader
        title="Mis reservaciones"
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "next", label: `Próximas (${next.length})` },
              { value: "past", label: "Historial" },
            ]}
          />
        }
      />
      {list.length === 0 ? (
        <Empty
          icon={<Ticket size={32} />}
          title={tab === "next" ? "No tienes clases próximas" : "Aún no tienes historial"}
          action={tab === "next" && <Button onClick={() => router.push("/alumno/horario")}>Reservar clase</Button>}
        />
      ) : (
        <Card className="divide-y divide-line">
          {list.map(({ r, s }) => {
            const d = db.disciplines.find((x) => x.id === s.disciplineId);
            const t = db.users.find((x) => x.id === s.teacherId);
            // Las reservas de invitados también se abren: en la hoja se ven y se pueden cancelar.
            const canOpen = tab === "next";
            return (
              <button
                key={r.id}
                disabled={!canOpen}
                onClick={() => setOpen(s)}
                className="flex w-full items-center gap-3 p-4 text-left disabled:cursor-default"
              >
                <div className="w-12 shrink-0 text-center">
                  <p className="text-xs uppercase text-muted">{fmt(s.startsAt, "MMM")}</p>
                  <p className="text-xl font-semibold tabular-nums">{fmt(s.startsAt, "d")}</p>
                </div>
                <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: d?.color }} />
                {/* El lugar va junto a la hora (no se corta); el profesor, en su propia línea. */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d?.name}</p>
                  {r.guestName && <p className="truncate text-sm text-brand-strong">Invitado/a: {r.guestName}</p>}
                  <p className="text-sm text-muted">
                    {fmt(s.startsAt, "EEEE HH:mm")}
                    {r.spot && (
                      <>
                        {" · "}
                        <span className="whitespace-nowrap font-medium text-ink">lugar {r.spot}</span>
                      </>
                    )}
                  </p>
                  {t && <p className="truncate text-xs text-muted">{t.name}</p>}
                </div>
                <div className="shrink-0">
                  {s.status === "cancelled" ? (
                    <span className="text-xs font-medium text-red-600">Clase cancelada</span>
                  ) : (
                    <ReservationStatusBadge status={r.status} late={r.lateCancel} upcoming={tab === "next"} />
                  )}
                </div>
              </button>
            );
          })}
        </Card>
      )}
      <BookingSheet
        session={open}
        user={user}
        onClose={() => setOpen(null)}
        onNeedPlan={(s) => router.push(`/alumno/paquetes?volver=${encodeURIComponent(s.id)}`)}
      />
    </div>
  );
}
