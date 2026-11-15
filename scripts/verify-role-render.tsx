import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import Overview from "../web/app/app/overview";
import { Profile } from "../web/app/app/account-tools";
import { User } from "@edubest/shared";
const data = {
  students: 1,
  groups: 1,
  sessions: 1,
  due_centimes: 250000,
  collected_centimes: 0,
  attendance: { present: 1, total: 1 },
  upcoming: [],
  outstanding: [],
  cashflow: [],
  recent_students: [],
  recent_payments: [],
  group_overview: [],
  attendance_breakdown: {
    from: "2026-10-01",
    to: "2026-10-31",
    students: [],
    teachers: [],
  },
};
for (const role of ["STUDENT", "PARENT", "TEACHER", "OWNER"] as const) {
  const user = {
    id: "fixture",
    tenant_id: "fixture",
    name: "Nom Prénom",
    email: "fixture@example.test",
    role,
    locale: "fr",
    school: "EduBest",
    slug: "edubest",
    verified: true,
  } as User;
  const html = renderToStaticMarkup(
    <Overview
      data={data}
      user={user}
      lang="fr"
      navigate={() => {}}
      openSession={() => {}}
      openNotice={() => {}}
      onStudent={() => {}}
      onSession={() => {}}
      attendance={() => {}}
    />,
  );
  if (role === "STUDENT" || role === "PARENT") {
    for (const forbidden of [
      "Encaissé ce mois",
      "Encaissements de la semaine",
      "Élèves inscrits",
      "Inscrire un élève",
      "Les groupes de l’école",
    ])
      assert(!html.includes(forbidden), `${role}: ${forbidden}`);
    assert(html.includes(role === "STUDENT" ? "MON ESPACE ÉLÈVE" : "MON ESPACE PARENT"));
    assert(html.includes(role === "STUDENT" ? "Mon agenda" : "Tous mes enfants"));
  }
  if (role === "TEACHER") assert(html.includes("Ma rémunération du mois"));
  const profile = renderToStaticMarkup(<Profile user={user} lang="ar" />);
  assert(profile.includes("Nom Prénom"));
  assert(profile.includes("fixture@example.test"));
  assert(profile.includes("ملفي الشخصي"));
}
console.log("Rendu serveur FR/AR des quatre rôles : réussi, sans navigateur.");
