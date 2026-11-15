import { test } from "node:test";
import assert from "node:assert/strict";
import { personalHome } from "../shared/dist/personal-home.js";

const at = new Date("2026-10-27T08:30:00Z");
const lesson = (id, start, end, status, children, extra = {}) => ({
  id,
  starts_at: start,
  ends_at: end,
  status,
  children,
  ...extra,
});
const data = {
  personal: {
    children: [
      { id: "a", name: "Amira", group_ids: ["g1", "shared"] },
      { id: "b", name: "Yanis", group_ids: ["g2", "shared"] },
    ],
    agenda: [
      lesson("past", "2026-10-27T06:00Z", "2026-10-27T07:00Z", "completed", [
        { id: "a" },
      ]),
      lesson(
        "cancelled",
        "2026-10-27T08:00Z",
        "2026-10-27T09:00Z",
        "cancelled",
        [{ id: "b" }],
      ),
      lesson("ongoing", "2026-10-27T08:00Z", "2026-10-27T09:00Z", "scheduled", [
        { id: "a" },
      ]),
      lesson(
        "tomorrow",
        "2026-10-28T09:00Z",
        "2026-10-28T10:00Z",
        "scheduled",
        [{ id: "b" }],
      ),
      lesson("far", "2026-11-28T09:00Z", "2026-11-28T10:00Z", "scheduled", [
        { id: "a" },
      ]),
    ],
    notices: [{ id: "notice" }],
    announcements: [
      { id: "all", group_id: null },
      { id: "only-a", group_id: "g1" },
      { id: "only-b", group_id: "g2" },
    ],
    absences: [{ student_id: "a" }, { student_id: "b" }],
  },
  outstanding_personal: [{ student_id: "a" }, { student_id: "b" }],
  attendance_breakdown: {
    students: [{ id: "a" }, { id: "b" }],
    teachers: [{ id: "t" }],
  },
};
test("Agenda : cours en cours prioritaire, terminé et annulé exclus du prochain cours", () => {
  const h = personalHome(data, "", at);
  assert.equal(h.next.id, "ongoing");
  assert.equal(h.cancelled[0].id, "cancelled");
  assert.equal(
    h.week.some((r) => r.id === "far"),
    false,
  );
  assert.equal(h.days.length, 7);
});
test("Parent : filtre enfant appliqué aux cours, échéances, absences, annonces et statistiques", () => {
  const h = personalHome(data, "b", at);
  assert.equal(h.next.id, "tomorrow");
  assert.deepEqual(
    h.outstanding.map((r) => r.student_id),
    ["b"],
  );
  assert.deepEqual(
    h.absences.map((r) => r.student_id),
    ["b"],
  );
  assert.deepEqual(
    h.announcements.map((r) => r.id),
    ["all", "only-b"],
  );
  assert.deepEqual(
    h.stats.students.map((r) => r.id),
    ["b"],
  );
  assert.deepEqual(h.stats.teachers, []);
});
test("Calendrier : minuit algérien, retour à tous les enfants après retrait du lien", () => {
  assert.equal(
    personalHome(data, "", new Date("2026-10-27T23:30Z")).today,
    "2026-10-28",
  );
  assert.equal(personalHome(data, "ancien-enfant", at).childId, "");
  assert.equal(personalHome(data, "ancien-enfant", at).outstanding.length, 2);
});
test("Enseignant : appels commencés uniquement, aucune action sur une annulation", () => {
  const teacher = {
    personal: {
      agenda: [
        lesson(
          "now",
          "2026-10-27T08:00Z",
          "2026-10-27T09:00Z",
          "scheduled",
          [],
          { call: { expected: 2, marked: 0 } },
        ),
        lesson(
          "cancel",
          "2026-10-27T07:00Z",
          "2026-10-27T08:00Z",
          "cancelled",
          [],
          { call: { expected: 2, marked: 0 } },
        ),
        lesson(
          "future",
          "2026-10-28T07:00Z",
          "2026-10-28T08:00Z",
          "scheduled",
          [],
          { call: { expected: 2, marked: 0 } },
        ),
      ],
    },
  };
  assert.deepEqual(
    personalHome(teacher, "", at).pending.map((r) => r.id),
    ["now"],
  );
});
test("Agenda vide et réponse ancienne : aucun faux cours ni taux inventé", () => {
  const h = personalHome({}, "", at);
  assert.equal(h.next, undefined);
  assert.deepEqual(h.children, []);
  assert.deepEqual(h.week, []);
  assert.equal(h.stats, null);
});
