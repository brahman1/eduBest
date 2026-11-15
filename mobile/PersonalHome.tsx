import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import {
  User,
  HomeRow,
  personalHome,
  childColors,
  calendarDay,
  dinars,
} from "@edubest/shared";
import { AttendanceStats } from "./AccountTools";
import { theme } from "./theme";
import Constants from "expo-constants";

export default function PersonalHome({
  data,
  user,
  ar,
  nav,
  openSession,
  openNotice,
  onAttendance,
}: {
  data: HomeRow;
  user: User;
  ar: boolean;
  nav: (p: string) => void;
  openSession: (r: HomeRow) => void;
  openNotice: (r: HomeRow) => void;
  onAttendance: (r: HomeRow) => void;
}) {
  const [selected, select] = useState("");
  const [chosenDay, chooseDay] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const h = personalHome(data, selected, now),
    parent = user.role === "PARENT",
    teacher = user.role === "TEACHER";
  const t = (f: string, a: string) => (ar ? a : f),
    lang = ar ? "ar" : "fr";
  const day = h.days.includes(chosenDay) ? chosenDay : h.today;
  const date = (
    v: string,
    options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      day: "numeric",
      month: "long",
    },
  ) =>
    new Date(v.length === 10 ? `${v}T12:00:00+01:00` : v).toLocaleString(
      ar ? "ar-DZ" : "fr-DZ",
      { timeZone: "Africa/Algiers", ...options },
    );
  const time = (v: string) => date(v, { hour: "2-digit", minute: "2-digit" });
  const button = (label: string, fn: () => void, primary = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={fn}
      style={[s.button, primary && s.primary]}
    >
      <Text
        style={{
          color: primary ? theme.surface : theme.action,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const title = (label: string) => (
    <Text accessibilityRole="header" style={s.title}>
      {label}
    </Text>
  );
  const row = (key: string, heading: string, body: string, fn: () => void) => (
    <Pressable key={key} accessibilityRole="button" onPress={fn} style={s.list}>
      <Text style={s.bold}>{heading}</Text>
      <Text style={s.text}>{body}</Text>
    </Pressable>
  );
  const lesson = (r: HomeRow, primary = false) => (
    <View
      key={r.id}
      style={[
        s.lesson,
        primary && s.next,
        r.status === "cancelled" && s.cancelled,
      ]}
    >
      <View style={s.line}>
        <Text style={s.bold}>
          {time(r.starts_at)} — {time(r.ends_at)}
        </Text>
        <Text style={s.badge}>
          {r.status === "cancelled"
            ? t("Annulé", "ملغاة")
            : r.status === "completed"
              ? t("Terminé", "منتهية")
              : Date.parse(r.starts_at) <= now.getTime() &&
                  Date.parse(r.ends_at) > now.getTime()
                ? t("En cours", "جارية")
                : Date.parse(r.ends_at) <= now.getTime()
                  ? t("À clôturer", "بانتظار الإنهاء")
                  : t("Prévu", "مبرمجة")}
        </Text>
      </View>
      {primary && <Text style={s.text}>{date(r.starts_at)}</Text>}
      {title(r.subject || r.group_name)}
      <Text style={s.text}>
        {r.group_name} ·{" "}
        {r.room
          ? `${t("Salle", "القاعة")} ${r.room}`
          : t("Salle à confirmer", "القاعة قيد التأكيد")}
      </Text>
      <Text style={s.text}>
        {teacher
          ? `${r.student_count ?? 0} ${t("élèves inscrits", "تلاميذ مسجلين")}`
          : r.teacher_name ||
            t("Professeur à confirmer", "الأستاذ قيد التأكيد")}
      </Text>
      {parent && (
        <View style={s.line}>
          {r.children?.map((c: HomeRow) => (
            <Text
              key={c.id}
              style={[
                s.child,
                {
                  borderColor:
                    childColors[
                      Math.max(
                        0,
                        h.children.findIndex((x) => x.id === c.id),
                      ) % childColors.length
                    ],
                },
              ]}
            >
              {c.name}
            </Text>
          ))}
        </View>
      )}
      {button(
        t("Détails du cours", "تفاصيل الحصة"),
        () => openSession(r),
        primary,
      )}
      {teacher &&
        r.status !== "cancelled" &&
        Date.parse(r.starts_at) <= now.getTime() &&
        button(t("Faire l’appel", "تسجيل الحضور"), () => onAttendance(r))}
    </View>
  );
  if (!data.personal)
    return (
      <View style={s.panel}>
        <Text style={s.title}>
          {t("Votre espace personnel", "مساحتك الشخصية")}
        </Text>
        <Text style={s.text}>
          {Constants.expoConfig?.extra?.internalTest
            ? t(
                "Le serveur doit recevoir la nouvelle version des tableaux de bord. Le planning et vos documents restent accessibles ci-dessous.",
                "يحتاج الخادم إلى تحديث لوحات المتابعة. يبقى الجدول والوثائق متاحين أدناه.",
              )
            : t(
                "L’accueil personnalisé n’est pas disponible pour le moment. Retrouvez vos cours dans le planning.",
                "الصفحة الشخصية غير متاحة حاليًا. اطّلع على حصصك في الجدول.",
              )}
        </Text>
        {button(
          t("Ouvrir mon planning", "فتح جدولي"),
          () => nav("sessions"),
          true,
        )}
        {button(t("Mes documents", "وثائقي"), () => nav("materials"))}
        {button(t("Mes notifications", "إشعاراتي"), () => nav("notifications"))}
      </View>
    );
  return (
    <View style={{ gap: 18, direction: ar ? "rtl" : "ltr" }}>
      <View style={s.hero}>
        <Text style={{ color: theme.pale, fontWeight: "700" }}>
          {teacher
            ? t("MON ESPACE ENSEIGNANT", "مساحتي كأستاذ")
            : parent
              ? t("MON ESPACE PARENT", "مساحتي كولي")
              : t("MON ESPACE ÉLÈVE", "مساحتي كتلميذ")}
        </Text>
        <Text style={s.greeting}>
          {t("Bonjour", "مرحبًا")}, {user.name}
        </Text>
        <Text style={{ color: theme.sidebarText }}>
          {date(h.today)} · {t("Heure d’Alger", "توقيت الجزائر")}
        </Text>
      </View>
      {parent && (
        <View style={s.panel}>
          {title(t("Mes enfants", "أبنائي"))}
          <View style={s.line}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: !h.childId }}
              onPress={() => select("")}
              style={[s.filter, !h.childId && s.active]}
            >
              <Text style={s.bold}>{t("Tous mes enfants", "جميع أبنائي")}</Text>
            </Pressable>
            {h.children.map((c, i) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityState={{ selected: h.childId === c.id }}
                onPress={() => select(c.id)}
                style={[
                  s.filter,
                  h.childId === c.id && s.active,
                  {
                    borderStartColor: childColors[i % childColors.length],
                    borderStartWidth: 5,
                  },
                ]}
              >
                <Text style={s.bold}>{c.name}</Text>
                <Text style={s.text}>{c.level}</Text>
              </Pressable>
            ))}
          </View>
          {!h.children.length && (
            <Text style={s.text}>
              {t(
                "Aucun enfant associé. Contactez la direction.",
                "لا يوجد طفل مرتبط بحسابك. تواصل مع الإدارة.",
              )}
            </Text>
          )}
        </View>
      )}
      {h.cancelled.map((r) => (
        <View key={r.id} style={[s.panel, s.cancelled]}>
          {row(
            r.id,
            t("Cours annulé", "حصة ملغاة"),
            `${r.group_name} · ${date(r.starts_at)} · ${time(r.starts_at)}${parent ? ` · ${r.children.map((c: HomeRow) => c.name).join("، ")}` : ""}`,
            () => openSession(r),
          )}
        </View>
      ))}
      {parent && h.childId && h.notices.length > 0 && (
        <Text style={s.text}>
          {t(
            "Les notifications du compte parent concernent toute la famille.",
            "إشعارات حساب الولي تخص جميع أفراد العائلة.",
          )}
        </Text>
      )}
      {h.notices.slice(0, 3).map((r: HomeRow) => (
        <View key={r.id} style={s.panel}>
          {row(r.id, r.title, r.body, () => openNotice({ ...r, notice: true }))}
          <Text style={s.text}>{t("Touchez pour lire", "اضغط للقراءة")}</Text>
        </View>
      ))}
      {title(t("Prochain cours", "الحصة القادمة"))}
      {h.next ? (
        lesson(h.next, true)
      ) : (
        <View style={s.panel}>
          <Text style={s.bold}>
            {t(
              "Aucun cours à venir dans les 90 prochains jours.",
              "لا توجد حصة قادمة خلال 90 يومًا.",
            )}
          </Text>
          {button(t("Consulter le planning complet", "عرض الجدول الكامل"), () =>
            nav("sessions"),
          )}
        </View>
      )}
      <View style={s.panel}>
        {title(t("Mon agenda", "جدولي"))}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={{
            gap: 8,
            paddingVertical: 8,
            flexDirection: ar ? "row-reverse" : "row",
          }}
        >
          {h.days.map((d) => (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: day === d }}
              onPress={() => chooseDay(d)}
              style={[s.day, day === d && s.active]}
            >
              <Text style={s.text}>{date(d, { weekday: "short" })}</Text>
              <Text style={s.title}>{date(d, { day: "numeric" })}</Text>
              <Text style={s.text}>
                {
                  h.week.filter(
                    (r) =>
                      calendarDay(r.starts_at) === d &&
                      r.status !== "cancelled",
                  ).length
                }{" "}
                {t("cours", "حصص")}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {title(day === h.today ? t("Aujourd’hui", "اليوم") : date(day))}
        {h.week
          .filter((r) => calendarDay(r.starts_at) === day)
          .map((r) => lesson(r))}
        {!h.week.some((r) => calendarDay(r.starts_at) === day) && (
          <Text style={s.text}>
            {t("Aucun cours ce jour.", "لا توجد حصة في هذا اليوم.")}
            {h.next
              ? ` ${t("Prochain cours :", "الحصة القادمة:")} ${date(h.next.starts_at)} · ${time(h.next.starts_at)}`
              : ""}
          </Text>
        )}
        {button(t("Planning complet", "الجدول الكامل"), () => nav("sessions"))}
      </View>
      {teacher ? (
        <View style={s.panel}>
          {title(
            t("Appels et séances à finaliser", "الحضور والحصص المطلوب إكمالها"),
          )}
          <Text style={s.text}>
            {t(
              "Séances commencées sur les 30 derniers jours.",
              "الحصص التي بدأت خلال آخر 30 يومًا.",
            )}
          </Text>
          {h.pending
            .slice(0, 6)
            .map((r) =>
              row(
                r.id,
                r.group_name,
                `${date(r.starts_at)} · ${r.call.marked}/${r.call.expected} ${t("présences renseignées", "حضور مسجل")} · ${r.call.marked === r.call.expected ? t("Terminer la séance", "إنهاء الحصة") : t("Compléter l’appel", "إكمال الحضور")}`,
                () => onAttendance(r),
              ),
            )}
          {!h.pending.length && (
            <Text style={s.text}>
              {t(
                "Tous les appels et séances commencées sont à jour.",
                "جميع سجلات الحضور والحصص محدثة.",
              )}
            </Text>
          )}
        </View>
      ) : (
        <View style={s.panel}>
          {title(t("Présences à suivre", "متابعة الحضور"))}
          {h.absences.map((r) =>
            row(
              `${r.lesson_id}-${r.student_id}`,
              `${parent ? `${r.student_name} · ` : ""}${r.group_name}`,
              `${date(r.starts_at)} · ${t("Absence", "غياب")} · ${r.decision === "accepted" ? t("Justification acceptée", "التبرير مقبول") : r.decision === "rejected" ? t("Justification refusée", "التبرير مرفوض") : t("Justification en attente", "التبرير قيد الانتظار")}`,
              () => {
                const lesson = data.personal?.agenda?.find(
                  (l: HomeRow) => l.id === r.lesson_id,
                );
                lesson ? openSession(lesson) : nav("sessions");
              },
            ),
          )}
          {!h.absences.length && (
            <Text style={s.text}>
              {t(
                "Aucune absence enregistrée sur les 30 derniers jours.",
                "لا يوجد غياب مسجل خلال آخر 30 يومًا.",
              )}
            </Text>
          )}
        </View>
      )}
      <View style={s.panel}>
        {title(t("Annonces récentes", "الإعلانات الأخيرة"))}
        {h.announcements
          .slice(0, 4)
          .map((r) =>
            row(r.id, r.title, `${date(r.created_at)} · ${r.body}`, () =>
              openNotice(r),
            ),
          )}
        {!h.announcements.length && (
          <Text style={s.text}>
            {t(
              "Aucune annonce sur les 30 derniers jours.",
              "لا يوجد إعلان خلال آخر 30 يومًا.",
            )}
          </Text>
        )}
        {button(t("Toutes les annonces", "جميع الإعلانات"), () =>
          nav("announcements"),
        )}
      </View>
      <View style={s.panel}>
        {title(t("Documents de cours", "وثائق الدروس"))}
        <Text style={s.text}>
          {t(
            "Les supports partagés dans vos groupes.",
            "الوثائق المشتركة في مجموعاتك.",
          )}
        </Text>
        {button(t("Ouvrir les documents", "فتح الوثائق"), () =>
          nav("materials"),
        )}
      </View>
      {teacher ? (
        <View style={s.panel}>
          {title(t("Ma rémunération du mois", "أجري لهذا الشهر"))}
          <Text style={s.title}>
            {dinars(data.remuneration?.earned_centimes ?? 0, lang)}
          </Text>
          {button(t("Détail et versements", "التفاصيل والدفعات"), () =>
            nav("payroll"),
          )}
        </View>
      ) : (
        <View style={s.panel}>
          {title(
            parent
              ? t("Échéances de la famille", "مستحقات العائلة")
              : t("Mes échéances", "مستحقاتي"),
          )}
          {h.outstanding
            .slice(0, 5)
            .map((r) =>
              row(
                r.id,
                `${parent ? `${r.student_name} · ` : ""}${r.label}`,
                `${r.due_date < h.today ? t("En retard", "متأخرة") : t("À régler avant le", "تُدفع قبل")} ${date(r.due_date)} · ${dinars(r.balance_centimes, lang)}`,
                () => nav("invoices"),
              ),
            )}
          {!h.outstanding.length && (
            <Text style={s.text}>
              {t("Aucune échéance à régler.", "لا توجد مستحقات للدفع.")}
            </Text>
          )}
          {button(t("Consulter les échéances", "عرض المستحقات"), () =>
            nav("invoices"),
          )}
        </View>
      )}
      {h.stats && <AttendanceStats data={h.stats} ar={ar} />}
      {button(t("Mes notifications", "إشعاراتي"), () => nav("notifications"))}
    </View>
  );
}
const s = StyleSheet.create({
  hero: { backgroundColor: theme.navy, padding: 24, borderRadius: 20, gap: 12 },
  greeting: { color: theme.surface, fontSize: 26, fontWeight: "700" },
  panel: {
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: 1,
    padding: 18,
    borderRadius: 18,
    gap: 12,
  },
  title: { color: theme.ink, fontSize: 19, fontWeight: "700" },
  bold: { color: theme.ink, fontWeight: "700", fontSize: 15 },
  text: { color: theme.muted, lineHeight: 22, fontSize: 14 },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  lesson: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.surface,
    gap: 10,
  },
  next: { backgroundColor: theme.softBlue, borderColor: theme.accent },
  cancelled: { backgroundColor: theme.warningBg, borderColor: theme.warning },
  badge: { color: theme.action, fontWeight: "700", fontSize: 12 },
  child: {
    borderWidth: 1,
    borderStartWidth: 4,
    borderRadius: 8,
    padding: 7,
    color: theme.ink,
  },
  button: {
    minHeight: 46,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.line,
    justifyContent: "center",
    backgroundColor: theme.surface,
  },
  primary: { backgroundColor: theme.action, borderColor: theme.action },
  filter: {
    padding: 12,
    minHeight: 48,
    borderRadius: 12,
    borderColor: theme.line,
    borderWidth: 1,
  },
  active: { backgroundColor: theme.softBlue, borderColor: theme.action },
  day: {
    padding: 12,
    minWidth: 82,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 12,
    alignItems: "center",
    gap: 6,
  },
  list: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: theme.line,
    gap: 6,
    minHeight: 48,
  },
});
