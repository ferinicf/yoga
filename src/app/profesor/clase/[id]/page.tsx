"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { useCurrentUser, useDB } from "@/lib/store";
import { endTime, longDay, timeOf } from "@/lib/utils";
import { AttendanceList, SpotPicker } from "@/components/domain";
import { Badge, Card, Empty, buttonClass } from "@/components/ui";

export default function TeacherClassPage() {
  const { id } = useParams<{ id: string }>();
  const db = useDB();
  const user = useCurrentUser()!;
  const session = db.sessions.find((s) => s.id === id);

  if (!session || session.teacherId !== user.id) {
    return (
      <Empty
        title="Clase no encontrada"
        action={
          <Link href="/profesor" className={buttonClass({ variant: "outline" })}>
            Volver a mis clases
          </Link>
        }
      />
    );
  }
  const d = db.disciplines.find((x) => x.id === session.disciplineId);
  const room = db.rooms.find((x) => x.id === session.roomId);

  return (
    <div className="space-y-5">
      <Link href="/profesor" className="-ml-1 inline-flex min-h-10 items-center gap-1 px-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Mis clases
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
            <span className="h-3 w-3 rounded-full" style={{ background: d?.color }} />
            {d?.name}
          </h1>
          <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
            <span className="flex items-center gap-1">
              <Clock size={15} /> {longDay(session.startsAt)} · {timeOf(session.startsAt)}–{endTime(session.startsAt, session.durationMin)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={15} /> {room?.name}
            </span>
          </p>
        </div>
        {session.status === "cancelled" && <Badge tone="red">Clase cancelada</Badge>}
      </div>
      {session.notes && <Card className="p-4 text-sm">{session.notes}</Card>}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <AttendanceList session={session} staffId={user.id} />
        {db.settings.spotSelection && (
          <Card className="h-fit p-4">
            <p className="mb-3 font-semibold">Mapa del salón</p>
            <SpotPicker session={session} />
          </Card>
        )}
      </div>
    </div>
  );
}
