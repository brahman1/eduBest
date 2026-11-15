import React, { useEffect, useRef, useState } from "react";
import { View, Text, Modal, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  recurrenceInput,
  exclusionPeriod,
  calendarDay,
  shiftDay,
  RecurrenceRule,
  ClosurePeriod,
} from "@edubest/shared";
import { Panel, Button, Input, ui } from "./NativeUi";
import { api } from "./api";
import { theme } from "./theme";
type Row = Record<string, any>;
const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
export default function MobileRecurrence({
  ar,
  groups,
  admin,
  onChanged,
}: {
  ar: boolean;
  groups: Row[];
  admin: boolean;
  onChanged: () => void;
}) {
  const t = (f: string, a: string) => (ar ? a : f);
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState("repeat"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState<Row | null>(null),
    [series, setSeries] = useState<Row[]>([]),
    [closures, setClosures] = useState<Row[]>([]);
  const today = calendarDay(new Date());
  const [draft, setDraft] = useState<RecurrenceRule>({
    group_id: groups[0]?.id ?? "",
    from: today,
    to: shiftDay(today, 90),
    weekdays: [0],
    start_time: "09:00",
    duration_minutes: 60,
    interval_weeks: 1,
    room: "",
    notes: "",
    excluded_months: [],
    excluded_dates: [],
    excluded_periods: [],
    skip_conflicts: false,
  });
  const [dates, setDates] = useState(""),
    [periods, setPeriods] = useState<ClosurePeriod[]>([]),
    [period, setPeriod] = useState({ label: "", from: today, to: today }),
    [closure, setClosure] = useState({ label: "", from: today, to: today }),
    [affected, setAffected] = useState<Row[] | null>(null),
    [cancel, setCancel] = useState(false);
  const requestId = useRef("");
  const weekdays = [
    t("Dim", "الأحد"),
    t("Lun", "الإثنين"),
    t("Mar", "الثلاثاء"),
    t("Mer", "الأربعاء"),
    t("Jeu", "الخميس"),
    t("Ven", "الجمعة"),
    t("Sam", "السبت"),
  ];
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(2026, i, 15).toLocaleString(ar ? "ar-DZ" : "fr-DZ", {
      month: "short",
    }),
  );
  const format = (s: string) =>
    new Date(s.length === 10 ? s + "T12:00:00+01:00" : s).toLocaleString(
      ar ? "ar-DZ" : "fr-DZ",
      {
        timeZone: "Africa/Algiers",
        dateStyle: "medium",
        ...(s.length === 10 ? {} : { timeStyle: "short" }),
      },
    );
  function update(v: Partial<RecurrenceRule>) {
    setDraft((d) => ({ ...d, ...v }));
    setPreview(null);
    requestId.current = "";
    setMessage("");
  }
  function closureUpdate(v: Partial<typeof closure>) {
    setClosure((c) => ({ ...c, ...v }));
    setAffected(null);
    setCancel(false);
  }
  async function refresh() {
    const [s, c] = await Promise.all([
      api("planning/series"),
      api("planning/closures"),
    ]);
    setSeries(s);
    setClosures(c);
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const payload = () =>
    recurrenceInput.parse({
      ...draft,
      excluded_dates: dates.split(/[\s,;]+/).filter(Boolean),
      excluded_periods: periods,
    });
  const confirm = (title: string, body: string, fn: () => Promise<void>) =>
    Alert.alert(title, body, [
      { text: t("Garder", "الاحتفاظ"), style: "cancel" },
      {
        text: t("Confirmer", "تأكيد"),
        style: "destructive",
        onPress: () => void run(fn),
      },
    ]);
  function show() {
    setError("");
    setMessage("");
    setOpen(true);
    setDraft((d) => ({
      ...d,
      group_id: groups.some((g) => g.id === d.group_id)
        ? d.group_id
        : (groups[0]?.id ?? ""),
    }));
    void run(refresh);
  }
  return (
    <>
      <Button
        title={t("Cours récurrents et fermetures", "الحصص المتكررة والإغلاقات")}
        onPress={show}
      />
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: theme.paper,
            direction: ar ? "rtl" : "ltr",
          }}
        >
          <View style={{ padding: 16 }}>
            <Button
              title={t("Fermer", "إغلاق")}
              disabled={busy}
              onPress={() => setOpen(false)}
            />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, gap: 16 }}
          >
            <Text style={ui.title}>
              {t("Programmer le rythme des cours", "برمجة وتيرة الدروس")}
            </Text>
            <Text style={ui.text}>
              {t(
                "Horaires d’Alger. Les fermetures de l’école sont exclues automatiquement.",
                "توقيت الجزائر. تُستثنى إغلاقات المدرسة تلقائيًا.",
              )}
            </Text>
            <View style={ui.row}>
              <Button
                title={t("Nouvelle série", "سلسلة جديدة")}
                selected={mode === "repeat"}
                disabled={busy}
                onPress={() => setMode("repeat")}
              />
              <Button
                title={t("Séries et fermetures", "السلاسل والإغلاقات")}
                selected={mode === "manage"}
                disabled={busy}
                onPress={() => setMode("manage")}
              />
            </View>
            {!!error && (
              <Text accessibilityRole="alert" style={ui.error}>
                {error}
              </Text>
            )}
            {!!message && <Text style={ui.success}>{message}</Text>}
            {mode === "repeat" && (
              <>
                <Panel title={t("Groupe et dates", "المجموعة والتواريخ")}>
                  <View style={ui.row}>
                    {groups.map((g) => (
                      <Button
                        key={g.id}
                        title={g.name}
                        selected={draft.group_id === g.id}
                        disabled={busy}
                        onPress={() => update({ group_id: g.id })}
                      />
                    ))}
                  </View>
                  {!groups.length && (
                    <Text style={ui.text}>
                      {t(
                        "Créez d’abord un groupe autorisé.",
                        "أنشئ مجموعة مسموحًا بها أولًا.",
                      )}
                    </Text>
                  )}
                  <Input
                    label={t("Du (AAAA-MM-JJ)", "من (YYYY-MM-DD)")}
                    value={draft.from}
                    disabled={busy}
                    onChange={(from) => update({ from })}
                  />
                  <Input
                    label={t(
                      "Au (AAAA-MM-JJ, inclus)",
                      "إلى (YYYY-MM-DD، شامل)",
                    )}
                    value={draft.to}
                    disabled={busy}
                    onChange={(to) => update({ to })}
                  />
                  <View style={ui.row}>
                    {weekdays.map((w, i) => (
                      <Button
                        key={i}
                        title={w}
                        selected={draft.weekdays.includes(i)}
                        disabled={busy}
                        onPress={() =>
                          update({
                            weekdays: draft.weekdays.includes(i)
                              ? draft.weekdays.filter((x) => x !== i)
                              : [...draft.weekdays, i],
                          })
                        }
                      />
                    ))}
                  </View>
                  <Input
                    label={t("Heure (HH:MM)", "الوقت (HH:MM)")}
                    value={draft.start_time}
                    disabled={busy}
                    onChange={(start_time) => update({ start_time })}
                  />
                  <Input
                    label={t("Durée (minutes)", "المدة (بالدقائق)")}
                    value={String(draft.duration_minutes)}
                    disabled={busy}
                    numeric
                    onChange={(v) => update({ duration_minutes: Number(v) })}
                  />
                  <Input
                    label={t(
                      "Toutes les N semaines (1 à 4)",
                      "كل N أسابيع (من 1 إلى 4)",
                    )}
                    value={String(draft.interval_weeks)}
                    disabled={busy}
                    numeric
                    onChange={(v) => update({ interval_weeks: Number(v) })}
                  />
                  <Input
                    label={t(
                      "Salle (vide = salle du groupe)",
                      "القاعة (فارغ = قاعة المجموعة)",
                    )}
                    value={draft.room}
                    disabled={busy}
                    onChange={(room) => update({ room })}
                  />
                  <Input
                    label={t("Notes", "ملاحظات")}
                    value={draft.notes}
                    multiline
                    disabled={busy}
                    onChange={(notes) => update({ notes })}
                  />
                </Panel>
                <Panel
                  title={t("Exceptions à cette série", "استثناءات هذه السلسلة")}
                >
                  <Text style={ui.text}>
                    {t("Mois à exclure", "الأشهر المستثناة")}
                  </Text>
                  <View style={ui.row}>
                    {months.map((m, i) => (
                      <Button
                        key={i}
                        title={m}
                        selected={draft.excluded_months.includes(i + 1)}
                        disabled={busy}
                        onPress={() =>
                          update({
                            excluded_months: draft.excluded_months.includes(
                              i + 1,
                            )
                              ? draft.excluded_months.filter((x) => x !== i + 1)
                              : [...draft.excluded_months, i + 1],
                          })
                        }
                      />
                    ))}
                  </View>
                  <Input
                    label={t(
                      "Dates exclues (AAAA-MM-JJ, séparées par des espaces)",
                      "تواريخ مستثناة (YYYY-MM-DD مفصولة بمسافات)",
                    )}
                    value={dates}
                    disabled={busy}
                    multiline
                    onChange={(v) => {
                      setDates(v);
                      update({});
                    }}
                  />
                  {periods.map((p, i) => (
                    <View key={i}>
                      <Text>
                        {p.label} · {p.from} — {p.to}
                      </Text>
                      <Button
                        title={t("Retirer cette période", "حذف هذه الفترة")}
                        disabled={busy}
                        onPress={() => {
                          setPeriods((ps) => ps.filter((_, n) => n !== i));
                          update({});
                        }}
                      />
                    </View>
                  ))}
                  <Input
                    label={t("Nom de la pause", "اسم العطلة")}
                    value={period.label}
                    disabled={busy}
                    onChange={(label) => setPeriod((p) => ({ ...p, label }))}
                  />
                  <Input
                    label={t(
                      "Début de pause (AAAA-MM-JJ)",
                      "بداية العطلة (YYYY-MM-DD)",
                    )}
                    value={period.from}
                    disabled={busy}
                    onChange={(from) => setPeriod((p) => ({ ...p, from }))}
                  />
                  <Input
                    label={t(
                      "Fin de pause (AAAA-MM-JJ)",
                      "نهاية العطلة (YYYY-MM-DD)",
                    )}
                    value={period.to}
                    disabled={busy}
                    onChange={(to) => setPeriod((p) => ({ ...p, to }))}
                  />
                  <Button
                    title={t(
                      "Ajouter cette pause à la série",
                      "إضافة هذه العطلة للسلسلة",
                    )}
                    disabled={busy}
                    onPress={() =>
                      void run(async () => {
                        const p = exclusionPeriod.parse(period);
                        setPeriods((ps) => [...ps, p]);
                        update({});
                      })
                    }
                  />
                  <Button
                    title={
                      draft.skip_conflicts
                        ? t(
                            "Ignorer les conflits : oui",
                            "تجاوز التعارضات: نعم",
                          )
                        : t("Ignorer les conflits : non", "تجاوز التعارضات: لا")
                    }
                    selected={draft.skip_conflicts}
                    disabled={busy}
                    onPress={() =>
                      update({ skip_conflicts: !draft.skip_conflicts })
                    }
                  />
                </Panel>
                <Button
                  title={t(
                    "Prévisualiser avant création",
                    "معاينة قبل الإنشاء",
                  )}
                  disabled={busy || !draft.group_id}
                  onPress={() =>
                    void run(async () => {
                      setPreview(
                        await api("planning/preview", "POST", payload()),
                      );
                    })
                  }
                />
                {preview && (
                  <Panel title={t("Vérifier les séances", "مراجعة الحصص")}>
                    <Text>
                      {preview.accepted.length}{" "}
                      {t("séances à créer", "حصص للإنشاء")} ·{" "}
                      {preview.excluded.length} {t("exclusions", "استثناءات")} ·{" "}
                      {preview.conflicts.length} {t("conflits", "تعارضات")}
                    </Text>
                    {preview.accepted.slice(0, 12).map((r: Row) => (
                      <Text key={r.date} style={ui.text}>
                        {format(r.starts_at)}
                      </Text>
                    ))}
                    {preview.excluded.slice(0, 8).map((r: Row) => (
                      <Text key={r.date} style={ui.text}>
                        {r.date} ·{" "}
                        {r.label ||
                          (
                            {
                              past: t("Passée", "ماضية"),
                              month: t("Mois exclu", "شهر مستثنى"),
                              date: t("Date exclue", "تاريخ مستثنى"),
                              period: t("Pause", "عطلة"),
                            } as Row
                          )[r.reason] ||
                          t("Fermeture", "إغلاق")}
                      </Text>
                    ))}
                    {preview.conflicts.slice(0, 8).map((r: Row) => (
                      <Text key={r.date} style={ui.error}>
                        {r.date} ·{" "}
                        {t(
                          "Conflit de groupe, salle ou enseignant",
                          "تعارض مجموعة أو قاعة أو أستاذ",
                        )}
                      </Text>
                    ))}
                    <Text style={ui.text}>
                      {t(
                        "La liste est résumée ; les totaux portent sur toute la période. Le serveur vérifie de nouveau les disponibilités au moment de créer.",
                        "القائمة مختصرة؛ الإجماليات تخص الفترة كاملة. يتحقق الخادم مجددًا من التوفر عند الإنشاء.",
                      )}
                    </Text>
                    <Button
                      title={t(
                        "Créer les séances prévisualisées",
                        "إنشاء الحصص المعاينة",
                      )}
                      disabled={
                        busy ||
                        !preview.accepted.length ||
                        (!draft.skip_conflicts && preview.conflicts.length > 0)
                      }
                      onPress={() =>
                        void run(async () => {
                          requestId.current ||= uuid();
                          const r = await api("planning/series", "POST", {
                            ...payload(),
                            request_id: requestId.current,
                          });
                          setPreview(null);
                          requestId.current = "";
                          setMessage(
                            `${r.created} ${t("séances créées.", "حصص أُنشئت.")}`,
                          );
                          await refresh();
                          onChanged();
                        })
                      }
                    />
                  </Panel>
                )}
              </>
            )}
            {mode === "manage" && (
              <>
                <Panel title={t("Séries existantes", "السلاسل الموجودة")}>
                  {series.map((s) => (
                    <View key={s.id} style={{ gap: 8 }}>
                      <Text style={ui.title}>{s.group_name}</Text>
                      <Text style={ui.text}>
                        {s.rule.from} — {s.rule.to} · {s.future}{" "}
                        {t("séances futures", "حصص قادمة")}
                      </Text>
                      <Button
                        title={t(
                          "Annuler les séances futures de cette série",
                          "إلغاء الحصص القادمة لهذه السلسلة",
                        )}
                        danger
                        disabled={busy || !s.future}
                        onPress={() =>
                          confirm(
                            t("Annuler la série ?", "إلغاء السلسلة؟"),
                            t(
                              "Les séances passées restent conservées. Les destinataires seront informés selon les canaux configurés.",
                              "تُحفظ الحصص الماضية. يُبلَّغ المعنيون حسب القنوات المهيأة.",
                            ),
                            async () => {
                              await api(
                                `planning/series/${s.id}/cancel`,
                                "POST",
                                {},
                              );
                              await refresh();
                              onChanged();
                            },
                          )
                        }
                      />
                    </View>
                  ))}
                  {!series.length && (
                    <Text style={ui.text}>
                      {t("Aucune série.", "لا توجد سلسلة.")}
                    </Text>
                  )}
                </Panel>
                <Panel title={t("Fermetures de l’école", "إغلاقات المدرسة")}>
                  {closures.map((c) => (
                    <View key={c.id}>
                      <Text>
                        {c.label} · {c.from} — {c.to}
                      </Text>
                      {admin && (
                        <Button
                          title={t(
                            "Retirer cette fermeture",
                            "حذف هذا الإغلاق",
                          )}
                          disabled={busy}
                          onPress={() =>
                            confirm(
                              t("Retirer la fermeture ?", "حذف الإغلاق؟"),
                              t(
                                "Les séances annulées ne seront pas rétablies automatiquement.",
                                "لن تُستعاد الحصص الملغاة تلقائيًا.",
                              ),
                              async () => {
                                await api(
                                  `planning/closures/${c.id}`,
                                  "DELETE",
                                );
                                await refresh();
                                onChanged();
                              },
                            )
                          }
                        />
                      )}
                    </View>
                  ))}
                  {!closures.length && (
                    <Text style={ui.text}>
                      {t(
                        "Aucune fermeture enregistrée.",
                        "لا يوجد إغلاق مسجل.",
                      )}
                    </Text>
                  )}
                </Panel>
                {admin && (
                  <Panel title={t("Ajouter une fermeture", "إضافة إغلاق")}>
                    <Input
                      label={t("Motif", "السبب")}
                      value={closure.label}
                      disabled={busy}
                      onChange={(label) => closureUpdate({ label })}
                    />
                    <Input
                      label={t("Du (AAAA-MM-JJ)", "من (YYYY-MM-DD)")}
                      value={closure.from}
                      disabled={busy}
                      onChange={(from) => closureUpdate({ from })}
                    />
                    <Input
                      label={t("Au (AAAA-MM-JJ)", "إلى (YYYY-MM-DD)")}
                      value={closure.to}
                      disabled={busy}
                      onChange={(to) => closureUpdate({ to })}
                    />
                    <Button
                      title={t("Voir les cours concernés", "عرض الحصص المعنية")}
                      disabled={busy}
                      onPress={() =>
                        void run(async () => {
                          exclusionPeriod.parse(closure);
                          const r = await api(
                            "planning/closures/preview",
                            "POST",
                            closure,
                          );
                          setAffected(r.affected);
                        })
                      }
                    />
                    {affected && (
                      <>
                        <Text style={ui.text}>
                          {affected.length}{" "}
                          {t("séances futures concernées", "حصص قادمة معنية")}
                        </Text>
                        {affected.slice(0, 8).map((r) => (
                          <Text key={r.id}>{format(r.starts_at)}</Text>
                        ))}
                        {affected.length > 0 && (
                          <Button
                            title={
                              cancel
                                ? t(
                                    "Annulation des cours confirmée",
                                    "إلغاء الحصص مؤكد",
                                  )
                                : t(
                                    "Confirmer l’annulation des cours concernés",
                                    "تأكيد إلغاء الحصص المعنية",
                                  )
                            }
                            selected={cancel}
                            disabled={busy}
                            onPress={() => setCancel(!cancel)}
                          />
                        )}
                        <Button
                          title={t("Enregistrer la fermeture", "حفظ الإغلاق")}
                          disabled={busy || (affected.length > 0 && !cancel)}
                          onPress={() =>
                            void run(async () => {
                              await api("planning/closures", "POST", {
                                ...closure,
                                cancel_sessions: cancel,
                              });
                              setAffected(null);
                              setCancel(false);
                              setMessage(
                                t("Fermeture enregistrée.", "تم حفظ الإغلاق."),
                              );
                              await refresh();
                              onChanged();
                            })
                          }
                        />
                      </>
                    )}
                  </Panel>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
