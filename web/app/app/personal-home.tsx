"use client";
import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Bell,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";
import {
  User,
  personalHome,
  childColors,
  calendarDay,
  dinars,
  HomeRow,
} from "@edubest/shared";
import { AttendanceStats } from "./account-tools";

export default function PersonalHome({
  data,
  user,
  lang,
  navigate,
  openSession,
  openNotice,
  attendance,
}: {
  data: HomeRow;
  user: User;
  lang: "fr" | "ar";
  navigate: (p: string) => void;
  openSession: (r: HomeRow) => void;
  openNotice: (r: HomeRow) => void;
  attendance: (r: HomeRow) => void;
}) {
  const [selected, select] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const ar = lang === "ar",
    t = (f: string, a: string) => (ar ? a : f);
  const h = personalHome(data, selected, now),
    teacher = user.role === "TEACHER",
    parent = user.role === "PARENT";
  const [chosenDay, chooseDay] = useState("");
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
  const children = (r: HomeRow) =>
    parent && (
      <div className="home-child-tags">
        {r.children?.map((c: HomeRow) => (
          <span
            key={c.id}
            style={{
              borderColor:
                childColors[
                  Math.max(
                    0,
                    h.children.findIndex((x) => x.id === c.id),
                  ) % childColors.length
                ],
            }}
          >
            {c.name}
          </span>
        ))}
      </div>
    );
  const status = (r: HomeRow) =>
    r.status === "cancelled"
      ? t("Annulé", "ملغاة")
      : r.status === "completed"
        ? t("Terminé", "منتهية")
        : Date.parse(r.starts_at) <= now.getTime() &&
            Date.parse(r.ends_at) > now.getTime()
          ? t("En cours", "جارية")
          : Date.parse(r.ends_at) <= now.getTime()
            ? t("À clôturer", "بانتظار الإنهاء")
            : t("Prévu", "مبرمجة");
  const lesson = (r: HomeRow, primary = false) => (
    <article
      key={r.id}
      className={`home-lesson ${primary ? "home-next" : ""} ${r.status === "cancelled" ? "is-cancelled" : ""}`}
    >
      <div className="home-lesson-heading">
        <span>
          <Clock3 size={16} /> {time(r.starts_at)} — {time(r.ends_at)}
        </span>
        <span className="home-status">{status(r)}</span>
      </div>
      {primary && <p className="home-eyebrow">{date(r.starts_at)}</p>}
      <h3>{r.subject || r.group_name}</h3>
      <p>
        {r.group_name}
        {r.room
          ? ` · ${t("Salle", "القاعة")} ${r.room}`
          : ` · ${t("Salle à confirmer", "القاعة قيد التأكيد")}`}
      </p>
      <p>
        {teacher
          ? `${r.student_count ?? 0} ${t("élèves inscrits", "تلاميذ مسجلين")}`
          : r.teacher_name ||
            t("Professeur à confirmer", "الأستاذ قيد التأكيد")}
      </p>
      {children(r)}
      <div className="home-actions">
        <button className="button" onClick={() => openSession(r)}>
          {t("Détails du cours", "تفاصيل الحصة")} <ArrowUpRight size={15} />
        </button>
        {teacher &&
          r.status !== "cancelled" &&
          Date.parse(r.starts_at) <= now.getTime() && (
            <button className="button secondary" onClick={() => attendance(r)}>
              {t("Faire l’appel", "تسجيل الحضور")}
            </button>
          )}
      </div>
    </article>
  );
  return (
    <div className="personal-home" dir={ar ? "rtl" : "ltr"}>
      <header className="home-welcome">
        <div>
          <span className="home-eyebrow">
            {teacher
              ? t("MON ESPACE ENSEIGNANT", "مساحتي كأستاذ")
              : parent
                ? t("MON ESPACE PARENT", "مساحتي كولي")
                : t("MON ESPACE ÉLÈVE", "مساحتي كتلميذ")}
          </span>
          <h2>
            {t("Bonjour", "مرحبًا")}, {user.name}
          </h2>
          <p>
            {date(h.today)} · {t("Heure d’Alger", "توقيت الجزائر")}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => navigate("notifications")}
        >
          <Bell size={17} /> {t("Mes notifications", "إشعاراتي")}
        </button>
      </header>
      {parent && (
        <section
          className="home-family"
          aria-label={t("Choisir un enfant", "اختيار طفل")}
        >
          <button aria-pressed={!h.childId} onClick={() => select("")}>
            {t("Tous mes enfants", "جميع أبنائي")}
          </button>
          {h.children.map((c, i) => (
            <button
              key={c.id}
              aria-pressed={h.childId === c.id}
              onClick={() => select(c.id)}
            >
              <span
                className="home-color"
                style={{ background: childColors[i % childColors.length] }}
              />
              {c.name}
              <small>{c.level}</small>
            </button>
          ))}
          {!h.children.length && (
            <p>
              {t(
                "Aucun enfant associé à votre compte. Contactez la direction.",
                "لا يوجد طفل مرتبط بحسابك. تواصل مع الإدارة.",
              )}
            </p>
          )}
        </section>
      )}
      {(h.cancelled.length > 0 || h.notices.length > 0) && (
        <section
          className="home-alerts"
          aria-label={t("Informations importantes", "معلومات مهمة")}
        >
          {h.cancelled.map((r) => (
            <button
              key={r.id}
              className="home-alert warning"
              onClick={() => openSession(r)}
            >
              <strong>
                {t("Cours annulé", "حصة ملغاة")} · {r.group_name}
              </strong>
              <span>
                {date(r.starts_at)} · {time(r.starts_at)}
                {parent
                  ? ` · ${r.children.map((c: HomeRow) => c.name).join("، ")}`
                  : ""}
              </span>
            </button>
          ))}
          {parent && h.childId && h.notices.length > 0 && (
            <p className="help-note">
              {t(
                "Les notifications du compte parent concernent toute la famille.",
                "إشعارات حساب الولي تخص جميع أفراد العائلة.",
              )}
            </p>
          )}
          {h.notices.slice(0, 3).map((r: HomeRow) => (
            <button
              key={r.id}
              className="home-alert"
              onClick={() => openNotice({ ...r, notice: true })}
            >
              <strong>{r.title}</strong>
              <span>{r.body}</span>
              <small>{t("Lire cette notification", "قراءة الإشعار")}</small>
            </button>
          ))}
        </section>
      )}
      <div className="home-main">
        <section>
          <div className="home-section-title">
            <h3>
              <CalendarDays size={20} /> {t("Prochain cours", "الحصة القادمة")}
            </h3>
          </div>
          {h.next ? (
            lesson(h.next, true)
          ) : (
            <div className="home-empty">
              <CalendarDays size={30} />
              <h3>{t("Votre agenda est à jour", "جدولك محدّث")}</h3>
              <p>
                {t(
                  "Aucun cours à venir dans les 90 prochains jours. Consultez le planning complet pour les autres dates.",
                  "لا توجد حصة قادمة خلال 90 يومًا. راجع الجدول الكامل لباقي التواريخ.",
                )}
              </p>
            </div>
          )}
        </section>
        <section className="home-agenda">
          <div className="home-section-title">
            <h3>{t("Mon agenda", "جدولي")}</h3>
            <button className="home-link" onClick={() => navigate("sessions")}>
              {t("Planning complet", "الجدول الكامل")} →
            </button>
          </div>
          <div
            className="home-days"
            aria-label={t("Les sept prochains jours", "الأيام السبعة القادمة")}
          >
            {h.days.map((d) => (
              <button
                key={d}
                onClick={() => chooseDay(d)}
                aria-pressed={day === d}
              >
                <span>{date(d, { weekday: "short" })}</span>
                <strong>{date(d, { day: "numeric" })}</strong>
                <small>
                  {
                    h.week.filter(
                      (r) =>
                        calendarDay(r.starts_at) === d &&
                        r.status !== "cancelled",
                    ).length
                  }{" "}
                  {t("cours", "حصص")}
                </small>
              </button>
            ))}
          </div>
          <h4>{day === h.today ? t("Aujourd’hui", "اليوم") : date(day)}</h4>
          <div className="home-agenda-list">
            {h.week
              .filter((r) => calendarDay(r.starts_at) === day)
              .map((r) => lesson(r))}
            {!h.week.some((r) => calendarDay(r.starts_at) === day) && (
              <p className="home-empty-note">
                {t("Aucun cours ce jour.", "لا توجد حصة في هذا اليوم.")}
                {h.next && (
                  <>
                    <br />
                    {t("Prochain rendez-vous :", "الحصة القادمة:")}{" "}
                    {date(h.next.starts_at)} {t("à", "على")}{" "}
                    {time(h.next.starts_at)}.
                  </>
                )}
              </p>
            )}
          </div>
        </section>
      </div>
      <div className="home-secondary-grid">
        {teacher ? (
          <section className="home-panel">
            <h3>
              {t(
                "Appels et séances à finaliser",
                "الحضور والحصص المطلوب إكمالها",
              )}
            </h3>
            <p className="help-note">
              {t(
                "Séances commencées sur les 30 derniers jours.",
                "الحصص التي بدأت خلال آخر 30 يومًا.",
              )}
            </p>
            {h.pending.slice(0, 6).map((r) => (
              <button
                className="home-list-row"
                key={r.id}
                onClick={() => attendance(r)}
              >
                <strong>{r.group_name}</strong>
                <span>
                  {date(r.starts_at)} · {r.call.marked}/{r.call.expected}{" "}
                  {t("présences renseignées", "حضور مسجل")}
                </span>
                <small>
                  {r.call.marked === r.call.expected
                    ? t("Terminer la séance", "إنهاء الحصة")
                    : t("Compléter l’appel", "إكمال الحضور")}
                </small>
              </button>
            ))}
            {!h.pending.length && (
              <p>
                {t(
                  "Tous les appels et séances commencées sont à jour.",
                  "جميع سجلات الحضور والحصص محدثة.",
                )}
              </p>
            )}
          </section>
        ) : (
          <section className="home-panel">
            <h3>{t("Présences à suivre", "متابعة الحضور")}</h3>
            {h.absences.map((r) => (
              <button
                className="home-list-row"
                key={`${r.lesson_id}-${r.student_id}`}
                onClick={() => {
                  const lesson = data.personal?.agenda?.find(
                    (l: HomeRow) => l.id === r.lesson_id,
                  );
                  lesson ? openSession(lesson) : navigate("sessions");
                }}
              >
                <strong>
                  {parent ? `${r.student_name} · ` : ""}
                  {r.group_name}
                </strong>
                <span>
                  {date(r.starts_at)} · {t("Absence", "غياب")}
                </span>
                <small>
                  {r.decision === "accepted"
                    ? t("Justification acceptée", "التبرير مقبول")
                    : r.decision === "rejected"
                      ? t("Justification refusée", "التبرير مرفوض")
                      : t("Justification en attente", "التبرير قيد الانتظار")}
                </small>
              </button>
            ))}
            {!h.absences.length && (
              <p>
                {t(
                  "Aucune absence enregistrée sur les 30 derniers jours.",
                  "لا يوجد غياب مسجل خلال آخر 30 يومًا.",
                )}
              </p>
            )}
          </section>
        )}
        <section className="home-panel">
          <h3>{t("Annonces récentes", "الإعلانات الأخيرة")}</h3>
          {h.announcements.slice(0, 4).map((r) => (
            <button
              className="home-list-row"
              key={r.id}
              onClick={() => openNotice(r)}
            >
              <strong>{r.title}</strong>
              <span>{date(r.created_at)}</span>
              <span className="home-excerpt">{r.body}</span>
            </button>
          ))}
          {!h.announcements.length && (
            <p>
              {t(
                "Aucune annonce sur les 30 derniers jours.",
                "لا يوجد إعلان خلال آخر 30 يومًا.",
              )}
            </p>
          )}
          <button
            className="home-link"
            onClick={() => navigate("announcements")}
          >
            {t("Toutes les annonces", "جميع الإعلانات")} →
          </button>
        </section>
      </div>
      <section className="home-resources">
        <BookOpen size={22} />
        <div>
          <h3>{t("Documents de cours", "وثائق الدروس")}</h3>
          <p>
            {t(
              "Retrouvez les supports partagés dans vos groupes.",
              "اطّلع على الوثائق المشتركة في مجموعاتك.",
            )}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => navigate("materials")}
        >
          {t("Ouvrir les documents", "فتح الوثائق")}
        </button>
      </section>
      {teacher ? (
        <section className="home-panel home-finance">
          <h3>{t("Ma rémunération du mois", "أجري لهذا الشهر")}</h3>
          <p>
            {dinars(data.remuneration?.earned_centimes ?? 0, lang)}{" "}
            {t("calculés", "محسوب")}
          </p>
          <button className="home-link" onClick={() => navigate("payroll")}>
            {t("Voir le détail et les versements", "عرض التفاصيل والدفعات")} →
          </button>
        </section>
      ) : (
        <section className="home-panel home-finance">
          <h3>
            {parent
              ? t("Échéances de la famille", "مستحقات العائلة")
              : t("Mes échéances", "مستحقاتي")}
          </h3>
          {h.outstanding.slice(0, 5).map((r) => (
            <button
              className="home-list-row"
              key={r.id}
              onClick={() => navigate("invoices")}
            >
              <strong>
                {parent ? `${r.student_name} · ` : ""}
                {r.label}
              </strong>
              <span>
                {r.due_date < h.today
                  ? t("En retard", "متأخرة")
                  : t("À régler avant le", "تُدفع قبل")}{" "}
                {date(r.due_date)} · {dinars(r.balance_centimes, lang)}
              </span>
            </button>
          ))}
          {!h.outstanding.length && (
            <p>{t("Aucune échéance à régler.", "لا توجد مستحقات للدفع.")}</p>
          )}
          <button className="home-link" onClick={() => navigate("invoices")}>
            {t("Consulter les échéances", "عرض المستحقات")} →
          </button>
        </section>
      )}
      {h.stats && <AttendanceStats data={h.stats} lang={lang} />}
    </div>
  );
}
