import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  AppState,
  ActivityIndicator,
} from "react-native";
import {
  calendarDay,
  calendarWeek,
  calendarMonth,
  shiftDay,
  dayLayout,
  childColors,
  User,
  adminRoles,
} from "@edubest/shared";
import { Panel, Button, Input, ui } from "./NativeUi";
import { theme } from "./theme";
import { api } from "./api";
import MobileRecurrence from "./MobileRecurrence";
type Row = Record<string, any>;
type Lesson = Row & { id: string; starts_at: string; ends_at: string };
export default function MobilePlanning({
  user,
  ar,
  revision,
  onOpen,
  onEdit,
  onNew,
  onAttendance,
}: {
  user: User;
  ar: boolean;
  revision: number;
  onOpen: (r: Row) => void;
  onEdit: (r: Row, groups: Row[]) => void;
  onNew: (groups: Row[]) => void;
  onAttendance: (r: Row) => void;
}) {
  const t = (f: string, a: string) => (ar ? a : f),
    admin = adminRoles.includes(user.role),
    writer = admin || user.role === "TEACHER";
  const [selected, setSelected] = useState(calendarDay(new Date())),
    [mode, setMode] = useState("week"),
    [jump, setJump] = useState(""),
    [group, setGroup] = useState(""),
    [child, setChild] = useState(""),
    [rows, setRows] = useState<Lesson[]>([]),
    [groups, setGroups] = useState<Row[]>([]),
    [children, setChildren] = useState<Row[]>([]),
    [closures, setClosures] = useState<Row[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const seq = useRef(0),
    today = calendarDay(new Date());
  const days =
      mode === "week" ? calendarWeek(selected) : calendarMonth(selected),
    from = days[0],
    to = shiftDay(days[days.length - 1], 1);
  useEffect(() => {
    let live = true;
    const id = ++seq.current;
    setBusy(true);
    setError("");
    Promise.all([
      api(`sessions?from=${from}&to=${to}`),
      api("groups"),
      api("planning/closures"),
      user.role === "PARENT" ? api("dashboard") : Promise.resolve(null),
    ])
      .then(([r, g, c, d]) => {
        if (live && id === seq.current) {
          setRows(r);
          setGroups(g);
          setClosures(c);
          setChildren(d?.personal?.children ?? []);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [from, to, revision, version, user.id]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setVersion((v) => v + 1);
    });
    return () => sub.remove();
  }, []);
  const selectedChild = children.find((c) => c.id === child);
  const shown = rows.filter(
    (r) =>
      (!group || r.group_id === group) &&
      (!selectedChild || selectedChild.group_ids.includes(r.group_id)),
  );
  const date = (
    v: string,
    options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ) =>
    new Date(v.length === 10 ? v + "T12:00:00+01:00" : v).toLocaleString(
      ar ? "ar-DZ" : "fr-DZ",
      { timeZone: "Africa/Algiers", ...options },
    );
  const time = (v: string) =>
    date(v, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const go = (n: number) => {
    if (mode === "week") setSelected(shiftDay(selected, n * 7));
    else {
      const d = new Date(`${selected.slice(0, 7)}-01T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + n);
      setSelected(d.toISOString().slice(0, 10));
    }
  };
  const count = (d: string) =>
    dayLayout(
      shown.filter((r) => r.status !== "cancelled"),
      d,
    ).length;
  const lessons = dayLayout(shown, selected).map((x) => x.row);
  return (
    <View style={{ gap: 16, direction: ar ? "rtl" : "ltr" }}>
      <Panel title={t("Mon planning", "جدولي")}>
        <Text style={ui.text}>
          {t(
            "Heure d’Alger · sélectionnez un jour pour voir ses cours.",
            "توقيت الجزائر · اختر يومًا لعرض حصصه.",
          )}
        </Text>
        <View style={ui.row}>
          <Button
            title={t("Semaine", "أسبوع")}
            selected={mode === "week"}
            onPress={() => setMode("week")}
          />
          <Button
            title={t("Mois", "شهر")}
            selected={mode === "month"}
            onPress={() => setMode("month")}
          />
          <Button
            title={t("Aujourd’hui", "اليوم")}
            onPress={() => setSelected(today)}
          />
        </View>
        <View style={{ ...ui.row, justifyContent: "space-between" }}>
          <Button title={t("Précédent", "السابق")} onPress={() => go(-1)} />
          <Text style={ui.title}>
            {date(selected, { month: "long", year: "numeric" })}
          </Text>
          <Button title={t("Suivant", "التالي")} onPress={() => go(1)} />
        </View>
        <Input
          label={t("Aller au (AAAA-MM-JJ)", "انتقال إلى (YYYY-MM-DD)")}
          value={jump}
          onChange={setJump}
        />
        <Button
          title={t("Afficher cette date", "عرض هذا التاريخ")}
          onPress={() => {
            if (
              /^\d{4}-\d{2}-\d{2}$/.test(jump) &&
              Number.isFinite(Date.parse(jump)) &&
              new Date(jump).toISOString().slice(0, 10) === jump
            ) {
              setSelected(jump);
              setError("");
            } else
              setError(
                t(
                  "Utilisez une date valide au format AAAA-MM-JJ.",
                  "استخدم تاريخًا صالحًا بالتنسيق YYYY-MM-DD.",
                ),
              );
          }}
        />
        {groups.length > 1 && (
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            <Button
              title={t("Tous mes groupes", "جميع مجموعاتي")}
              selected={!group}
              onPress={() => setGroup("")}
            />
            {groups.map((g) => (
              <Button
                key={g.id}
                title={g.name}
                selected={group === g.id}
                onPress={() => setGroup(g.id)}
              />
            ))}
          </ScrollView>
        )}
        {user.role === "PARENT" && children.length > 0 && (
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            <Button
              title={t("Tous mes enfants", "جميع أبنائي")}
              selected={!selectedChild}
              onPress={() => setChild("")}
            />
            {children.map((c) => (
              <Button
                key={c.id}
                title={c.name}
                selected={child === c.id}
                onPress={() => setChild(c.id)}
              />
            ))}
          </ScrollView>
        )}
      </Panel>
      {writer && (
        <>
          <Button
            title={t("Planifier une séance", "جدولة حصة")}
            onPress={() => onNew(groups)}
            disabled={busy}
          />
          <MobileRecurrence
            groups={groups}
            ar={ar}
            admin={admin}
            onChanged={() => setVersion((v) => v + 1)}
          />
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
      {busy && <ActivityIndicator color={theme.action} />}
      <Panel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          {days.map((d) => (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === d }}
              accessibilityLabel={`${date(d)} · ${count(d)} ${t("cours", "حصص")}`}
              onPress={() => setSelected(d)}
              style={{
                width: "12.7%",
                minHeight: mode === "month" ? 66 : 88,
                paddingVertical: 10,
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: selected === d ? theme.action : theme.line,
                backgroundColor:
                  selected === d
                    ? theme.softBlue
                    : d === today
                      ? theme.soft
                      : theme.surface,
                opacity:
                  mode === "month" && d.slice(0, 7) !== selected.slice(0, 7)
                    ? 0.5
                    : 1,
              }}
            >
              <Text style={{ fontSize: 10, color: theme.muted }}>
                {date(d, { weekday: "short" })}
              </Text>
              <Text
                style={{ fontSize: 17, fontWeight: "700", color: theme.ink }}
              >
                {date(d, { day: "numeric" })}
              </Text>
              <Text style={{ fontSize: 10, color: theme.action }}>
                {count(d) > 0 ? `${count(d)} ${t("cours", "حصص")}` : "—"}
              </Text>
            </Pressable>
          ))}
        </View>
      </Panel>
      <Text accessibilityRole="header" style={ui.title}>
        {date(selected)}
      </Text>
      {closures
        .filter((c) => c.from <= selected && c.to >= selected)
        .map((c) => (
          <Text
            key={c.id}
            style={{
              ...ui.error,
              color: theme.warning,
              backgroundColor: theme.warningBg,
            }}
          >
            {t("École fermée", "المدرسة مغلقة")} · {c.label}
          </Text>
        ))}
      {lessons.map((r) => {
        const index = Math.max(
          0,
          groups.findIndex((g) => g.id === r.group_id),
        );
        const affected = children.filter((c) =>
          c.group_ids.includes(r.group_id),
        );
        return (
          <View
            key={r.id}
            style={{
              ...ui.panel,
              borderStartWidth: 5,
              borderStartColor: childColors[index % childColors.length],
              backgroundColor:
                r.status === "cancelled" ? theme.warningBg : theme.surface,
            }}
          >
            <View style={{ ...ui.row, justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "700", color: theme.ink }}>
                {time(r.starts_at)} — {time(r.ends_at)}
              </Text>
              <Text style={ui.text}>
                {r.status === "cancelled"
                  ? t("Annulé", "ملغاة")
                  : r.status === "completed"
                    ? t("Terminé", "منتهية")
                    : t("Prévu", "مبرمجة")}
              </Text>
            </View>
            <Text style={ui.title}>{r.subject || r.group_name}</Text>
            <Text style={ui.text}>
              {r.group_name} ·{" "}
              {r.room || t("Salle à confirmer", "القاعة قيد التأكيد")}
            </Text>
            <Text style={ui.text}>
              {r.teacher_name ||
                t("Enseignant à confirmer", "الأستاذ قيد التأكيد")}
            </Text>
            {affected.map((c) => (
              <Text
                key={c.id}
                style={{
                  color:
                    childColors[
                      children.findIndex((x) => x.id === c.id) %
                        childColors.length
                    ],
                  fontWeight: "700",
                }}
              >
                {c.name}
              </Text>
            ))}
            <Button
              title={t("Détails", "التفاصيل")}
              onPress={() =>
                onOpen({
                  ...r,
                  children: affected.map((c) => ({ id: c.id, name: c.name })),
                })
              }
            />
            {writer && r.status === "scheduled" && (
              <Button
                title={t("Modifier la séance", "تعديل الحصة")}
                onPress={() => onEdit(r, groups)}
              />
            )}
            {writer &&
              r.status !== "cancelled" &&
              Date.parse(r.starts_at) <= Date.now() && (
                <Button
                  title={t("Faire l’appel", "تسجيل الحضور")}
                  onPress={() => onAttendance(r)}
                />
              )}
          </View>
        );
      })}
      {!busy && !lessons.length && (
        <Panel>
          <Text style={ui.text}>
            {t(
              "Aucun cours pour cette journée et ces filtres.",
              "لا توجد حصة لهذا اليوم وفق هذه المرشحات.",
            )}
          </Text>
        </Panel>
      )}
    </View>
  );
}
