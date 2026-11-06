"use client";

import { useState } from "react";
import Link from "next/link";
import { isSameDay, startOfDay, subDays } from "date-fns";
import { CalendarX2, ChevronRight } from "lucide-react";
import { useCurrentUser, useDB } from "@/lib/store";
import { sessionsOn } from "@/lib/rules";
import { longDay } from "@/lib/utils";
import { SessionCard } from "@/components/domain";
import { DayStrip } from "@/components/day-strip";
import { Card, Empty, PageHeader } from "@/components/ui";

export default function TeacherHome() {
  const db = useDB();
  const user = useCurrentUser()!;
  const [day, setDay] = useState(startOfDay(new Date()));
  const now = new Date();

  const mine = (d: Date) => sessionsOn(db, d, true).filter((s) => s.teacherId === user.id);
  const list = mine(day);
  const next = db.sessions
    .filter((s) => s.teacherId === user.id && s.status !== "cancelled" && new Date(s.startsAt).getTime() + s.durationMin * 60000 > now.getTime())
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];
  const weekCount = db.sessions.filter(
    (s) => s.teacherId === user.id && s.status !== "cancelled" && Math.abs(+new Date(s.startsAt) - +now) < 7 * 864e5 && new Date(s.startsAt) > now,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader title={`Hola, ${user.name.split(" ")[0]}`} subtitle={`${weekCount} clases en los próximos 7 días`} />

      {next && (
        <Link href={`/profesor/clase/${next.id}`}>
          <Card className="flex items-center gap-4 border-brand bg-brand-soft p-5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-strong">
                {isSameDay(new Date(next.startsAt), now) ? "Tu próxima clase hoy" : "Tu próxima clase"}
              </p>
              <p className="mt-1 text-xl font-semibold">{db.disciplines.find((d) => d.id === next.disciplineId)?.name}</p>
              <p className="text-sm text-muted">
                {longDay(next.startsAt)} · {new Date(next.startsAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <span className="flex items-center gap-1 text-sm font-medium text-brand-strong">
              Pasar lista <ChevronRight size={18} />
            </span>
          </Card>
        </Link>
      )}

      <DayStrip
        value={day}
        onChange={setDay}
        from={subDays(now, 7)}
        days={22}
        marks={(d) => mine(d).some((s) => s.status !== "cancelled")}
      />

      <div>
        <h2 className="mb-3 font-semibold">{longDay(day)}</h2>
        {list.length === 0 ? (
          <Empty icon={<CalendarX2 size={32} />} title="No tienes clases este día" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {list.map((s) => (
              <Link key={s.id} href={`/profesor/clase/${s.id}`}>
                <SessionCard session={s} right={<ChevronRight className="text-muted" />} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
