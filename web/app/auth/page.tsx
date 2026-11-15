"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Languages,
  ArrowRight,
  ArrowUpRight,
  Users,
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { api } from "../../lib/api";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  passwordGuidance,
  password,
} from "@edubest/shared";
import SchoolBrand, { BrandLogo } from "../school-brand";
import "../school.css";
import "./auth.css";
export default function Auth() {
  const publicSiteOnly =
    process.env.NEXT_PUBLIC_EDUBEST_PUBLIC_SITE_ONLY === "true";
  const [mode, setMode] = useState("login"),
    [rawToken, setRawToken] = useState(""),
    [ar, setAr] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const t = (f: string, a: string) => (ar ? a : f);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const requested = q.get("mode") ?? "login";
    setMode(
      ["login", "forgot", "verify", "reset", "invite"].includes(requested)
        ? requested
        : "login",
    );
    setRawToken(q.get("token") ?? "");
    if (q.has("token")) {
      q.delete("token");
      history.replaceState(
        history.state,
        "",
        location.pathname + (q.size ? "?" + q.toString() : ""),
      );
    }
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      if (["reset", "invite"].includes(mode)) {
        const parsed = password.safeParse(data.password);
        if (!parsed.success)
          throw new Error(passwordGuidance[ar ? "ar" : "fr"]);
      }
      if (["verify", "reset", "invite"].includes(mode)) {
        await api("auth/consume", "POST", {
          token: rawToken,
          ...(mode === "verify" ? {} : { password: data.password }),
        });
        setDone(true);
      } else if (mode === "forgot") {
        await api("auth/forgot", "POST", data);
        setDone(true);
      } else {
        const result = await api("auth/login", "POST", {
          ...data,
          session_mode: "cookie",
        });
        if (result.mfa_required) {
          setMfaRequired(true);
          setError(
            t(
              "Saisissez un code de votre application d’authentification ou un code de secours.",
              "أدخل رمز تطبيق المصادقة أو رمز الاسترداد.",
            ),
          );
          return;
        }
        location.href = "/app";
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const [mfaRequired, setMfaRequired] = useState(false);
  return (
    <main
      className="school-home school-auth"
      dir={ar ? "rtl" : "ltr"}
      lang={ar ? "ar" : "fr"}
    >
      <nav
        className="school-nav"
        aria-label={t("Navigation principale", "التنقل الرئيسي")}
      >
        <SchoolBrand subtitle={t("L’ESPACE DE NOTRE ÉCOLE", "مساحة مدرستنا")} />
        <div className="school-nav-actions">
          <Link className="school-nav-anchor" href="/">
            {t("Retour à l’accueil", "العودة إلى الرئيسية")}
            <ArrowUpRight size={15} />
          </Link>
          <button
            className="text-button"
            onClick={() => setAr(!ar)}
            aria-label={t("Afficher en arabe", "العرض بالفرنسية")}
          >
            <Languages size={17} />
            {ar ? "Français" : "العربية"}
          </button>
        </div>
      </nav>
      <div className="school-auth-layout">
        <section className="school-auth-copy">
          <span className="school-eyebrow">
            <span />
            {t(
              "L’ÉCOLE ET VOUS, AU MÊME ENDROIT",
              "المدرسة وأنتم، في مكان واحد",
            )}
          </span>
          <h1>
            {t("Grandir ensemble.", "ننمو معًا.")}
            <br />
            <em>{t("Chaque jour.", "كل يوم.")}</em>
          </h1>
          <p>
            {t(
              "Les cours, les familles et l’équipe d’EduBest, réunis dans un espace personnel. Retrouvez le fil de votre journée à l’école.",
              "دروس إديوبيست وعائلاتها وفريقها في فضاء شخصي واحد. تابعوا يومكم في المدرسة.",
            )}
          </p>
          <div className="school-auth-art" aria-hidden="true">
            <span className="school-auth-orbit" />
            <div className="school-auth-book">
              <BrandLogo mark width={102} />
              <span>✦</span>
            </div>
            <span className="school-auth-art-label">
              <Users size={18} />
              {t("L’école et la famille", "المدرسة والعائلة")}
            </span>
            <span className="school-auth-art-student">
              <GraduationCap size={22} />
            </span>
          </div>
        </section>
        <section
          className="auth-box school-auth-card"
          aria-labelledby="auth-title"
        >
          <span className="school-auth-icon" aria-hidden="true">
            <BrandLogo mark width={38} />
          </span>
          <span className="school-eyebrow">
            {t("BIENVENUE CHEZ EDUBEST", "مرحبًا بكم في إديوبيست")}
          </span>
          <h2 id="auth-title">
            {publicSiteOnly
              ? t("Votre espace arrive bientôt", "فضاؤكم متاح قريبًا")
              : mode === "login"
                ? t("Retrouvez votre espace", "ادخل إلى مساحتك")
                : mode === "forgot"
                  ? t("Retrouvez votre accès", "استعد الوصول")
                  : mode === "verify"
                    ? t("Vérifiez votre adresse", "تحقق من بريدك")
                    : t("Choisissez votre mot de passe", "اختر كلمة المرور")}
          </h2>
          <p className="school-auth-intro">
            {publicSiteOnly
              ? t(
                  "L’espace familles et l’application EduBest sont en préparation. L’école vous informera de leur ouverture.",
                  "فضاء العائلات وتطبيق إديوبست قيد التحضير. ستبلغكم المدرسة عند افتتاحهما.",
                )
              : mode === "login"
                ? t(
                    "Connectez-vous avec les accès fournis par votre école.",
                    "سجلوا الدخول بالحساب الذي تمنحه لكم مدرستكم.",
                  )
                : mode === "forgot"
                  ? t(
                      "Indiquez votre email pour recevoir un lien de récupération.",
                      "أدخلوا بريدكم الإلكتروني لاستلام رابط الاستعادة.",
                    )
                  : t(
                      "Finalisez votre accès à l’espace de votre école.",
                      "أكملوا تفعيل الوصول إلى فضاء مدرستكم.",
                    )}
          </p>
          {publicSiteOnly ? (
            <a className="button dark large" href="mailto:contact@edubest.dz">
              {t("Contacter l’école", "تواصلوا مع المدرسة")}
              <ArrowUpRight size={17} />
            </a>
          ) : done ? (
            <div className="success-state">
              <CheckCircle2 size={40} />
              <p>
                {mode === "forgot"
                  ? t(
                      "Si ce compte existe, un lien de réinitialisation a été envoyé.",
                      "إذا كان الحساب موجودًا، تم إرسال رابط الاستعادة.",
                    )
                  : t(
                      "Votre compte est prêt. Vous pouvez vous connecter.",
                      "حسابك جاهز. يمكنك الدخول.",
                    )}
              </p>
              <a href="/auth" className="button dark">
                {t("Se connecter", "دخول")}
              </a>
            </div>
          ) : (
            <form onSubmit={submit}>
              {["login", "forgot"].includes(mode) && (
                <>
                  <label>
                    {t("Email", "البريد الإلكتروني")}
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                    />
                  </label>
                </>
              )}
              {["login", "reset", "invite"].includes(mode) && (
                <label>
                  {t("Mot de passe", "كلمة المرور")}
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={mode === "login" ? 1 : PASSWORD_MIN_LENGTH}
                    maxLength={PASSWORD_MAX_LENGTH}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                  />
                  {mode !== "login" && (
                    <small>{passwordGuidance[ar ? "ar" : "fr"]}</small>
                  )}
                </label>
              )}
              {mode === "login" && mfaRequired && (
                <label>
                  {t(
                    "Code de double authentification ou de secours",
                    "رمز المصادقة الثنائية أو الاسترداد",
                  )}
                  <input
                    name="code"
                    autoComplete="one-time-code"
                    required
                    maxLength={24}
                  />
                  <small>
                    {t(
                      "Utilisez un nouveau code. Un code de secours ne peut servir qu’une fois.",
                      "استخدم رمزًا جديدًا. رمز الاسترداد صالح مرة واحدة.",
                    )}
                  </small>
                </label>
              )}
              {error && (
                <div role="alert" className="error-box">
                  {error}
                </div>
              )}
              <button className="button dark large" disabled={busy}>
                {busy
                  ? t("Un instant…", "لحظة…")
                  : mode === "verify"
                    ? t("Confirmer mon email", "تأكيد بريدي")
                    : mode === "forgot"
                      ? t("Envoyer le lien", "إرسال الرابط")
                      : mode === "login"
                        ? t("Se connecter", "دخول")
                        : t("Enregistrer", "حفظ")}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {!publicSiteOnly && mode === "login" && (
            <div className="auth-links">
              <Link href={ar ? "/inscription?lang=ar" : "/inscription"}>
                {t("Demander une inscription", "طلب التسجيل")}
              </Link>
              <a href="/auth?mode=forgot">
                {t("Mot de passe oublié ?", "نسيت كلمة المرور؟")}
              </a>
            </div>
          )}
          {!publicSiteOnly && (
            <p className="auth-help school-auth-help">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                {t(
                  "Votre compte est fourni par la direction d’EduBest. Pour activer un accès, utilisez votre invitation.",
                  "تمنحكم إدارة إديوبيست حسابكم. لتفعيل الوصول، استخدموا الدعوة المستلمة.",
                )}
              </span>
            </p>
          )}
        </section>
      </div>
      <footer className="school-auth-footer">
        <span>{t("Le savoir nous relie.", "المعرفة تجمعنا.")}</span>
        <Link href="/legal">
          {t("Confidentialité & conditions", "الخصوصية والشروط")}
        </Link>
      </footer>
    </main>
  );
}
