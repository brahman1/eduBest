"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  registrationCopy,
  registrationInput,
  schoolLevelLabel,
  schoolLevelOptions,
  type RegistrationCourse,
} from "@edubest/shared";
import { API, api } from "../../lib/api";
import SchoolBrand from "../school-brand";
import "../school.css";
import "./registration.css";

export default function Inscription() {
  const [ar, setAr] = useState(false);
  const [role, setRole] = useState<"STUDENT" | "PARENT">("STUDENT");
  const [kind, setKind] = useState<"new" | "existing">("new");
  const [catalog, setCatalog] = useState<{
    enabled: boolean;
    courses: RegistrationCourse[];
  }>();
  const [choices, setChoices] = useState<string[]>([]);
  const [level, setLevel] = useState("");
  const [customLevel, setCustomLevel] = useState("");
  const [ready, setReady] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [token, setToken] = useState("");
  const [done, setDone] = useState<"sent" | "confirmed">();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = (fr: string, arabic: string) => (ar ? arabic : fr);
  const copy = (key: keyof typeof registrationCopy) =>
    registrationCopy[key][ar ? 1 : 0];
  const siteOnly = process.env.NEXT_PUBLIC_EDUBEST_PUBLIC_SITE_ONLY === "true";

  async function loadCatalog() {
    setCatalogFailed(false);
    setCatalogLoading(true);
    try {
      const response = await fetch(`${API}/registrations/catalog`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Catalog unavailable");
      const data: { enabled: boolean; courses: RegistrationCourse[] } =
        await response.json();
      setCatalog(data);
      setChoices((old) =>
        old.filter((id) =>
          data.courses.some((c: RegistrationCourse) => c.id === id && !c.full),
        ),
      );
    } catch {
      setCatalogFailed(true);
    } finally {
      setCatalogLoading(false);
    }
  }

  useEffect(() => {
    setAr(new URLSearchParams(location.search).get("lang") === "ar");
    const confirmation = new URLSearchParams(location.hash.slice(1)).get(
      "confirm",
    );
    if (confirmation) {
      setToken(confirmation);
      history.replaceState(null, "", location.pathname + location.search);
    } else if (!siteOnly) void loadCatalog();
    setReady(true);
  }, [siteOnly]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = registrationInput.safeParse({
      role,
      student_kind: kind,
      first_name: form.get("first_name"),
      last_name: form.get("last_name"),
      email: form.get("email"),
      phone: form.get("phone"),
      locale: ar ? "ar" : "fr",
      ...(role === "PARENT"
        ? {
            child_first_name: form.get("child_first_name"),
            child_last_name: form.get("child_last_name"),
          }
        : {}),
      ...(kind === "new"
        ? {
            level: schoolLevelLabel(
              level === "__other__" ? customLevel : level,
            ),
          }
        : {}),
      group_ids: kind === "new" ? choices : [],
      acknowledged: form.has("acknowledged"),
    });
    if (!parsed.success) {
      setError(copy("invalid"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("registrations/request", "POST", parsed.data);
      setDone("sent");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await api("registrations/confirm", "POST", { token });
      setToken("");
      setDone("confirmed");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const courses = catalog?.courses ?? [];
  const available = courses.some((course) => !course.full);
  const levels = schoolLevelOptions(
    courses.map((course) => course.level),
    ar ? "ar" : "fr",
  );
  return (
    <main
      className="school-home registration-public"
      lang={ar ? "ar" : "fr"}
      dir={ar ? "rtl" : "ltr"}
    >
      <nav className="school-nav">
        <SchoolBrand />
        <div className="school-nav-actions">
          <Link href="/auth" className="school-nav-anchor" prefetch={false}>
            {copy("signIn")}
          </Link>
          <button
            type="button"
            className="text-button"
            onClick={() => setAr(!ar)}
          >
            {ar ? "Français" : "العربية"}
          </button>
        </div>
      </nav>
      <section className="registration-public-card">
        <h1>{copy("title")}</h1>
        {error && (
          <p role="alert" className="registration-error">
            {error}
          </p>
        )}
        {done ? (
          <p role="status" className="registration-info">
            {done === "sent"
              ? copy("sent")
              : t(
                  "Email confirmé. Votre demande a été transmise à l’école. Vous recevrez sa réponse par email.",
                  "تم تأكيد البريد وإرسال الطلب إلى المدرسة. سيصلك الرد عبر البريد الإلكتروني.",
                )}
          </p>
        ) : siteOnly ? (
          <p>{copy("unavailable")}</p>
        ) : token ? (
          <div className="registration-form">
            <p>
              {t(
                "Confirmez votre email pour transmettre votre demande à l’école.",
                "أكد بريدك لإرسال طلبك إلى المدرسة.",
              )}
            </p>
            <button
              className="button dark"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {t("Confirmer ma demande", "تأكيد طلبي")}
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setToken("");
                void loadCatalog();
              }}
            >
              {t("Revenir au formulaire", "العودة إلى الاستمارة")}
            </button>
          </div>
        ) : catalog?.enabled === false ? (
          <div>
            <p>{copy("unavailable")}</p>
            <button className="text-button" onClick={() => void loadCatalog()}>
              {t("Réessayer", "إعادة المحاولة")}
            </button>
          </div>
        ) : (
          <form className="registration-form" method="post" onSubmit={submit}>
            <p>{copy("intro")}</p>
            <fieldset className="registration-options">
              <legend>{t("Qui fait la demande ?", "من يقدم الطلب؟")}</legend>
              {(["STUDENT", "PARENT"] as const).map((item) => (
                <label key={item}>
                  <input
                    type="radio"
                    name="role_choice"
                    checked={role === item}
                    onChange={() => setRole(item)}
                  />
                  {copy(item === "STUDENT" ? "student" : "parent")}
                </label>
              ))}
            </fieldset>
            <fieldset className="registration-options">
              <legend>{t("Situation de l’élève", "وضع التلميذ")}</legend>
              {(["new", "existing"] as const).map((item) => (
                <label key={item}>
                  <input
                    type="radio"
                    name="kind_choice"
                    checked={kind === item}
                    onChange={() => setKind(item)}
                  />
                  {copy(item === "new" ? "newStudent" : "existing")}
                </label>
              ))}
            </fieldset>
            <div className="registration-fields">
              <label>
                {copy("firstName")}
                <input
                  name="first_name"
                  required
                  maxLength={60}
                  autoComplete="given-name"
                />
              </label>
              <label>
                {copy("lastName")}
                <input
                  name="last_name"
                  required
                  maxLength={60}
                  autoComplete="family-name"
                />
              </label>
              <label>
                {copy("phone")}
                <input
                  name="phone"
                  type="tel"
                  dir="ltr"
                  required
                  maxLength={32}
                  autoComplete="tel"
                  placeholder="05 00 00 00 00"
                />
              </label>
              <label>
                {copy("email")}
                <input
                  name="email"
                  type="email"
                  dir="ltr"
                  required
                  maxLength={254}
                  autoComplete="email"
                />
              </label>
              {role === "PARENT" && (
                <>
                  <label>
                    {copy("childFirstName")}
                    <input
                      name="child_first_name"
                      required
                      maxLength={60}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    {copy("childLastName")}
                    <input
                      name="child_last_name"
                      required
                      maxLength={60}
                      autoComplete="off"
                    />
                  </label>
                </>
              )}
              {kind === "new" && (
                <>
                  <label>
                    {copy("level")}
                    <select
                      required
                      value={level}
                      onChange={(event) => setLevel(event.target.value)}
                    >
                      <option value="">
                        {t("Choisir un niveau", "اختر المستوى")}
                      </option>
                      {levels.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                      <option value="__other__">
                        {t("Autre niveau", "مستوى آخر")}
                      </option>
                    </select>
                  </label>
                  {level === "__other__" && (
                    <label>
                      {t("Précisez le niveau", "حدّد المستوى")}
                      <input
                        required
                        maxLength={100}
                        value={customLevel}
                        onChange={(event) => setCustomLevel(event.target.value)}
                        placeholder={t("Ex. 3AS", "مثال: 3AS")}
                      />
                    </label>
                  )}
                </>
              )}
            </div>
            {kind === "new" && (
              <fieldset className="registration-options">
                <legend>{copy("courses")}</legend>
                <p role="status">
                  {catalogLoading
                    ? t("Chargement des cours…", "جارٍ تحميل الدروس…")
                    : catalogFailed
                      ? t(
                          "Impossible d’actualiser les cours.",
                          "تعذّر تحديث الدروس.",
                        )
                      : available
                        ? copy("coursesHelp")
                        : t(
                            "Aucun cours avec une place disponible pour le moment.",
                            "لا توجد أماكن متاحة في الدروس حاليًا.",
                          )}
                </p>
                <p>
                  {t(
                    "Vous pouvez envoyer votre demande sans choisir de cours. L’école pourra vous orienter.",
                    "يمكنك إرسال الطلب دون اختيار درس. ستساعدك المدرسة في الاختيار.",
                  )}
                </p>
                <button
                  type="button"
                  className="text-button"
                  disabled={catalogLoading}
                  onClick={() => void loadCatalog()}
                >
                  {t("Actualiser les cours", "تحديث الدروس")}
                </button>
                {courses.map((course) => (
                  <label key={course.id}>
                    <input
                      type="checkbox"
                      checked={choices.includes(course.id)}
                      disabled={
                        course.full ||
                        (choices.length >= 10 && !choices.includes(course.id))
                      }
                      onChange={(e) =>
                        setChoices(
                          e.target.checked
                            ? [...choices, course.id]
                            : choices.filter((id) => id !== course.id),
                        )
                      }
                    />
                    <span>
                      <strong>{course.name}</strong>
                      <small>
                        {[
                          course.subject,
                          schoolLevelLabel(course.level),
                          course.full ? copy("full") : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <Link
              href="/legal"
              target="_blank"
              rel="noopener noreferrer"
              prefetch={false}
            >
              {copy("privacy")}
            </Link>
            <label className="registration-check">
              <input name="acknowledged" type="checkbox" required />
              {copy("acknowledgement")}
            </label>
            <button className="button dark large" disabled={busy || !ready}>
              {busy ? t("Envoi en cours…", "جارٍ الإرسال…") : copy("submit")}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
