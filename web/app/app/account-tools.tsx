"use client";
import React, { useEffect, useState } from "react";
import { User, pageLabel, dinars } from "@edubest/shared";
import { API, api } from "../../lib/api";
type Row = Record<string, any>;
export function Profile({ user, lang }: { user: User; lang: "fr" | "ar" }) {
  const ar = lang === "ar";
  const roles: Record<string, string[]> = {
    OWNER: ["Administrateur principal", "المدير الرئيسي"],
    MANAGER: ["Administrateur", "المدير"],
    CASHIER: ["Caissier", "أمين الصندوق"],
    TEACHER: ["Enseignant", "أستاذ"],
    PARENT: ["Parent", "ولي"],
    STUDENT: ["Élève", "تلميذ"],
  };
  return (
    <section className="panel profile-panel">
      <h2>{ar ? "ملفي الشخصي" : "Mon profil"}</h2>
      <dl className="profile-details">
        {[
          [ar ? "الاسم الكامل" : "Nom et prénom", user.name],
          [ar ? "البريد الإلكتروني" : "Adresse email", user.email],
          [ar ? "الهاتف" : "Téléphone", user.phone || "—"],
          [ar ? "الدور" : "Rôle", roles[user.role][ar ? 1 : 0]],
          [ar ? "المؤسسة" : "Établissement", user.school],
          [
            ar ? "اللغة" : "Langue",
            user.locale === "ar" ? "العربية" : "Français",
          ],
          [
            ar ? "حالة البريد" : "Email vérifié",
            user.verified
              ? ar
                ? "نعم"
                : "Oui"
              : ar
                ? "في الانتظار"
                : "En attente",
          ],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="help-note">
        {ar
          ? "لتصحيح الاسم أو البريد أو الدور، تواصل مع إدارة المدرسة."
          : "Pour corriger votre identité, votre email ou votre rôle, contactez la direction de l’école."}
      </p>
    </section>
  );
}
export function AttendanceStats({
  data,
  lang,
}: {
  data: Row;
  lang: "fr" | "ar";
}) {
  const ar = lang === "ar";
  return (
    <section className="overview-panel">
      <h3>{ar ? "الحضور والغياب" : "Présences et absences"}</h3>
      <p className="help-note">
        {data.from} — {data.to} ·{" "}
        {ar
          ? "الحصص المنتهية فقط. المتأخرون ضمن الحضور. غير المسجلين مستبعدون من النسب."
          : "Séances terminées uniquement. Retards inclus dans la présence ; appels non renseignés exclus des taux."}
      </p>
      {[
        ["students", ar ? "حسب التلميذ" : "Par élève"],
        [
          "teachers",
          ar
            ? "حضور التلاميذ حسب الأستاذ"
            : "Présence des élèves par enseignant",
        ],
      ].map(([key, title]) => (
        <div key={key}>
          <h4>{title}</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    ar ? "الاسم" : "Nom",
                    ar ? "الحضور" : "Présence",
                    ar ? "الغياب" : "Absence",
                    ar ? "متأخر" : "Retards",
                    ar ? "غير مسجل" : "Non renseignés",
                  ].map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data[key]?.map((r: Row) => (
                  <tr key={r.id ?? "none"}>
                    <td>{r.name}</td>
                    <td>
                      {r.presence_rate === null ? "—" : `${r.presence_rate}%`} (
                      {r.present + r.late}/{r.marked})
                    </td>
                    <td>
                      {r.absence_rate === null ? "—" : `${r.absence_rate}%`} (
                      {r.absent})
                    </td>
                    <td>{r.late}</td>
                    <td>{r.unmarked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data[key]?.length && (
              <p className="help-note">
                {ar
                  ? "لا يوجد نداء مسجل خلال هذه الفترة."
                  : "Aucun appel renseigné sur cette période."}
              </p>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
export function Exports({ lang }: { lang: "fr" | "ar" }) {
  const ar = lang === "ar",
    today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Africa/Algiers",
    });
  const [from, setFrom] = useState(today.slice(0, 7) + "-01"),
    [to, setTo] = useState(today),
    [dataset, setDataset] = useState("all"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function download(format: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        `${API}/reports/export?${new URLSearchParams({ from, to, dataset, format })}`,
        { credentials: "include" },
      );
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.message ?? "Export indisponible");
      }
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `edubest-${dataset}-${from}-${to}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>{ar ? "التصدير والتقارير" : "Exports & bilans"}</h2>
      <p>
        {ar
          ? "للمديرين فقط. الفترة حسب توقيت الجزائر. يُطلب تأكيد الهوية قبل تصدير البيانات."
          : "Réservé aux administrateurs. Période en heure d’Alger. La confirmation de votre identité dans Sécurité est requise avant l’export."}
      </p>
      <div className="form-grid">
        <label>
          {ar ? "من" : "Du"}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          {ar ? "إلى" : "Au"}
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          {ar ? "البيانات" : "Données"}
          <select value={dataset} onChange={(e) => setDataset(e.target.value)}>
            {[
              ["all", "Tout", "الكل"],
              ["students", "Élèves", "التلاميذ"],
              ["parents", "Parents", "الأولياء"],
              ["teachers", "Enseignants", "الأساتذة"],
              ["finance", "Bilan financier", "الحصيلة المالية"],
              ["attendance", "Présences et absences", "الحضور والغياب"],
            ].map(([v, fr, a]) => (
              <option key={v} value={v}>
                {ar ? a : fr}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="help-note">
        {ar
          ? "القوائم تشمل جميع الملفات. الفترة تخص المستحقات والحركات المالية والحضور. الأجور المدفوعة لا تمثل حساب الأجور المستحقة."
          : "Les annuaires contiennent tous les dossiers. La période filtre les échéances, mouvements et présences. Le bilan distingue encaissements, remboursements et rémunérations versées ; il ne constitue pas un bilan comptable fiscal."}
      </p>
      <div className="actions">
        <button
          className="button"
          disabled={busy || !from || !to}
          onClick={() => void download("xlsx")}
        >
          Excel (.xlsx)
        </button>
        <button
          className="button secondary"
          disabled={busy || !from || !to}
          onClick={() => void download("json")}
        >
          JSON
        </button>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export function Delivery({ lang }: { lang: "fr" | "ar" }) {
  const ar = lang === "ar";
  const [data, setData] = useState<Row>({}),
    [error, setError] = useState("");
  async function load() {
    try {
      setData(await api("delivery"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="panel">
      <h2>{ar ? "متابعة الإرسال" : "Suivi des emails et notifications"}</h2>
      <p>
        {ar
          ? "قبول SMTP لا يؤكد استلام الرسالة. راجع إعدادات SPF وDKIM وDMARC وسمعة عنوان IP مع المستضيف عند رفض Microsoft."
          : "« SMTP accepté » ne confirme pas la réception en boîte mail. Un refus Microsoft peut nécessiter une correction SPF, DKIM, DMARC ou de réputation IP chez l’hébergeur."}
      </p>
      {data.smtp_configured === false && (
        <p className="alert error">
          {ar
            ? "خادم البريد غير مهيأ."
            : "Le serveur SMTP n’est pas configuré."}
        </p>
      )}
      <button className="button secondary" onClick={() => void load()}>
        {ar ? "تحديث" : "Actualiser"}
      </button>
      {error && <p className="alert error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {[
                "Date",
                ar ? "المستلم" : "Destinataire",
                ar ? "القناة" : "Canal",
                ar ? "الحالة" : "État",
                ar ? "التفاصيل" : "Détail",
                "",
              ].map((s, i) => (
                <th key={i}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.jobs?.map((r: Row) => (
              <tr key={r.id}>
                <td>
                  {new Date(r.created_at).toLocaleString(
                    ar ? "ar-DZ" : "fr-DZ",
                    { timeZone: "Africa/Algiers" },
                  )}
                </td>
                <td>
                  {r.recipient_name}
                  <small className="subtext">{r.recipient_email}</small>
                </td>
                <td>
                  {r.channel} · {r.topic}
                </td>
                <td>
                  {r.state === "sent"
                    ? r.channel === "email"
                      ? "SMTP accepté"
                      : r.receipt_checked
                        ? "Reçu push traité"
                        : "Push accepté"
                    : r.state}
                </td>
                <td>
                  {r.attempts} · {r.error_code}
                  <small className="subtext">{r.last_error}</small>
                </td>
                <td>
                  {r.retryable && (
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          await api(`delivery/${r.id}/retry`, "POST", {});
                          await load();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      {ar ? "إعادة المحاولة" : "Relancer"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
