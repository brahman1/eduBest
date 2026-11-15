"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  GraduationCap,
  Languages,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import "./school.css";
import SchoolBrand, { BrandLogo } from "./school-brand";
export default function SchoolHome() {
  const [ar, setAr] = useState(false);
  const t = (fr: string, arabic: string) => (ar ? arabic : fr);
  const portals = [
    {
      Icon: Users,
      fr: "Familles",
      ar: "العائلات",
      desc: "Suivez les présences, les échéances et les documents de vos enfants.",
      desca: "تابعوا حضور أبنائكم والمستحقات والوثائق.",
    },
    {
      Icon: GraduationCap,
      fr: "Élèves",
      ar: "التلاميذ",
      desc: "Consultez vos cours, les supports pédagogiques et les annonces de l’école.",
      desca: "اطلعوا على دروسكم والموارد التعليمية وإعلانات المدرسة.",
    },
    {
      Icon: BookOpen,
      fr: "Enseignants",
      ar: "الأساتذة",
      desc: "Retrouvez vos groupes, préparez vos séances et faites l’appel.",
      desca: "اطلعوا على مجموعاتكم وحضروا حصصكم وسجلوا الحضور.",
    },
    {
      Icon: Wallet,
      fr: "Administration",
      ar: "الإدارة",
      desc: "Organisez les inscriptions, le planning, les paiements et les accès.",
      desca: "نظموا التسجيلات والجدول والمدفوعات وصلاحيات الوصول.",
    },
  ];
  return (
    <main
      className="school-home"
      dir={ar ? "rtl" : "ltr"}
      lang={ar ? "ar" : "fr"}
    >
      <nav
        className="school-nav"
        aria-label={t("Navigation principale", "التنقل الرئيسي")}
      >
        <SchoolBrand subtitle={t("L’ESPACE DE NOTRE ÉCOLE", "مساحة مدرستنا")} />
        <div className="school-nav-actions">
          <a className="school-nav-anchor" href="#espaces">
            {t("Nos espaces", "مساحاتنا")}
          </a>
          <button
            className="text-button"
            onClick={() => setAr(!ar)}
            aria-label={t("Afficher en arabe", "العرض بالفرنسية")}
          >
            <Languages size={17} />
            {ar ? "Français" : "العربية"}
          </button>
          <Link href="/auth" className="button dark">
            {t("Connexion", "دخول")}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </nav>
      <section className="school-hero">
        <div className="school-hero-copy">
          <span className="school-eyebrow">
            <span />
            {t("ÉLÈVES · FAMILLES · ÉQUIPE", "التلاميذ · العائلات · الفريق")}
          </span>
          <h1>
            {t("Grandir ensemble.", "ننمو معًا.")}
            <br />
            <em>{t("Chaque jour.", "كل يوم.")}</em>
          </h1>
          <p>
            {t(
              "Bienvenue dans l’espace numérique d’EduBest. Les cours, le suivi scolaire et les échanges avec l’école, réunis pour accompagner chaque élève.",
              "مرحبًا بكم في الفضاء الرقمي لإديوبيست. الدروس والمتابعة الدراسية والتواصل مع المدرسة في مكان واحد لمرافقة كل تلميذ.",
            )}
          </p>
          <div className="school-hero-actions">
            <Link href="/auth" className="button dark large">
              {t("Accéder à mon espace", "الدخول إلى مساحتي")}
              <ArrowRight size={18} />
            </Link>
            {process.env.NEXT_PUBLIC_EDUBEST_PUBLIC_SITE_ONLY === "true" ? (
              <a href="#espaces" className="school-discover">
                {t("Découvrir EduBest", "اكتشف إديوبيست")}
                <ArrowUpRight size={18} />
              </a>
            ) : (
              <Link
                href={ar ? "/inscription?lang=ar" : "/inscription"}
                className="school-discover"
              >
                {t("Demander une inscription", "طلب التسجيل")}
                <ArrowUpRight size={18} />
              </Link>
            )}
          </div>
          <div className="school-hero-note">
            <ShieldCheck size={19} />
            <span>
              {t(
                "Un accès personnel, fourni par votre école.",
                "وصول شخصي تمنحه لكم مدرستكم.",
              )}
            </span>
          </div>
        </div>
        <div
          className="school-visual"
          aria-label={t(
            "Illustration du quotidien scolaire",
            "رسم توضيحي للحياة المدرسية",
          )}
        >
          <div className="school-orbit" />
          <div className="school-sticker">
            {t("LE SAVOIR", "المعرفة")}
            <br />
            <strong>{t("nous relie.", "تجمعنا.")}</strong>
            <span>✦</span>
          </div>
          <div className="school-agenda">
            <div className="school-agenda-head">
              <span className="school-book">
                <BrandLogo mark width={34} />
              </span>
              <span>
                <b>EduBest</b>
                <small>{t("Votre espace scolaire", "مساحتكم المدرسية")}</small>
              </span>
              <span className="school-small-star">✦</span>
            </div>
            <div className="school-agenda-title">
              <h3>{t("Place à la découverte.", "حان وقت الاكتشاف.")}</h3>
              <p>
                {t("Apprendre. Échanger. Progresser.", "نتعلم. نتبادل. نتقدم.")}
              </p>
            </div>
            {[
              [
                "01",
                "Planning et cours",
                "الجدول والدروس",
                "blue",
                "Retrouvez votre organisation",
                "اطلعوا على تنظيمكم",
              ],
              [
                "02",
                "Suivi scolaire",
                "المتابعة المدرسية",
                "amber",
                "Consultez vos informations",
                "اطلعوا على معلوماتكم",
              ],
              [
                "03",
                "Échanges avec l’école",
                "التواصل مع المدرسة",
                "purple",
                "Gardez le contact",
                "ابقوا على اتصال",
              ],
            ].map(([hour, fr, arabic, color, sub, subar]) => (
              <div className="school-lesson" key={hour}>
                <time>{hour}</time>
                <div className={`school-lesson-${color}`}>
                  <b>{t(fr, arabic)}</b>
                  <small>{t(sub, subar)}</small>
                </div>
                <Check size={17} />
              </div>
            ))}
            <div className="school-agenda-foot">
              <span />
              {t("Vos services dans un seul espace", "خدماتكم في مساحة واحدة")}
            </div>
          </div>
          <div className="school-family-note">
            <span>
              <Users size={23} />
            </span>
            <div>
              <b>{t("L’école et la famille", "المدرسة والعائلة")}</b>
              <small>
                {t("Le même cap, chaque jour.", "نفس الهدف، كل يوم.")}
              </small>
            </div>
          </div>
        </div>
      </section>
      <div className="school-values">
        <span>
          <BookOpen size={18} />
          {t("Le suivi des apprentissages", "متابعة التعلم")}
        </span>
        <span>
          <Users size={18} />
          {t("Le lien avec les familles", "التواصل مع العائلات")}
        </span>
        <span>
          <CalendarDays size={18} />
          {t("Une journée bien organisée", "يوم منظم")}
        </span>
      </div>
      <section id="espaces" className="school-portals">
        <div className="school-section-heading">
          <span className="school-eyebrow">
            {t("CHACUN SON ESPACE", "لكل شخص مساحته")}
          </span>
          <h2>{t("Toute l’école. Un même lien.", "كل المدرسة. رابط واحد.")}</h2>
          <p>
            {t(
              "Retrouvez les informations qui vous concernent, avec les accès attribués par la direction.",
              "اطلعوا على المعلومات الخاصة بكم حسب الصلاحيات التي تمنحها الإدارة.",
            )}
          </p>
        </div>
        <div className="school-portal-grid">
          {portals.map(({ Icon, fr, ar: arabic, desc, desca }, i) => (
            <Link href="/auth" className="school-portal" key={fr}>
              <div className="school-portal-top">
                <span>
                  <Icon size={25} />
                </span>
                <small>0{i + 1}</small>
              </div>
              <h3>{t(fr, arabic)}</h3>
              <p>{t(desc, desca)}</p>
              <span className="school-portal-link">
                {t("Me connecter", "الدخول")}
                <ArrowUpRight size={18} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="school-access">
        <div>
          <span className="school-eyebrow">
            {t("PREMIÈRE CONNEXION ?", "أول اتصال؟")}
          </span>
          <h2>
            {t("Votre école vous ouvre la porte.", "مدرستكم تفتح لكم الباب.")}
          </h2>
          <p>
            {t(
              "Votre compte est créé par l’administration. Activez-le avec votre invitation, ou rapprochez-vous du secrétariat pour obtenir votre accès.",
              "تنشئ الإدارة حسابكم. فعلوه باستخدام الدعوة أو اتصلوا بأمانة المدرسة للحصول على الوصول.",
            )}
          </p>
        </div>
        <Link href="/auth" className="button dark large">
          {t("J’ai déjà mon accès", "لدي حساب بالفعل")}
          <ArrowRight size={18} />
        </Link>
      </section>
      <footer className="school-footer">
        <SchoolBrand />
        <span>{t("Le savoir nous relie.", "المعرفة تجمعنا.")}</span>
        <Link href="/legal">
          {t("Confidentialité & conditions", "الخصوصية والشروط")}
        </Link>
      </footer>
    </main>
  );
}
