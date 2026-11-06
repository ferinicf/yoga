"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, GraduationCap, ShieldCheck, User as UserIcon } from "lucide-react";
import { useCurrentUser, useDB, useStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import { Avatar, Card, Segmented } from "@/components/ui";

const HOME: Record<Role, string> = { admin: "/admin", teacher: "/profesor", student: "/alumno" };

export default function LoginPage() {
  const db = useDB();
  const user = useCurrentUser();
  const login = useStore((s) => s.login);
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");

  useEffect(() => {
    if (user) router.replace(HOME[user.role]);
  }, [user, router]);

  const people = db.users.filter((u) => u.role === role && u.active);
  const icon = role === "admin" ? <ShieldCheck size={18} /> : role === "teacher" ? <GraduationCap size={18} /> : <UserIcon size={18} />;

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-2xl font-bold text-brand-ink">
            {db.settings.studioName.charAt(0)}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">{db.settings.studioName}</h1>
          <p className="mt-1 text-muted">{db.settings.tagline}</p>
        </div>

        <Card className="p-5">
          <p className="mb-1 text-sm font-medium">Modo demo</p>
          <p className="mb-4 text-sm text-muted">Elige un perfil para entrar. Los datos se guardan solo en este navegador.</p>
          <div className="mb-4 flex justify-center">
            <Segmented
              value={role}
              onChange={setRole}
              options={[
                { value: "student", label: "Alumno" },
                { value: "teacher", label: "Profesor" },
                { value: "admin", label: "Admin" },
              ]}
            />
          </div>
          <ul className="max-h-[50dvh] divide-y divide-line overflow-y-auto">
            {people.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => {
                    login(u.id);
                    router.push(HOME[u.role]);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-black/5"
                >
                  <Avatar name={u.name} color={u.color} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{u.name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted">
                      {icon} {u.email}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
