import SchoolBrand from "../school-brand";
import Link from "next/link";
import { publicNotice } from "../../lib/public-notice";
export default async function Legal() {
  const p = await publicNotice();
  return (
    <main className="legal">
      <SchoolBrand />
      <h1>Confidentialité et utilisation d’EduBest</h1>
      {p?.preopening && (
        <p role="status">
          Le site de présentation est ouvert. L’espace de gestion scolaire et
          les comptes familles ne sont pas encore disponibles ; aucune saisie de
          dossier d’élève n’est proposée.
        </p>
      )}
      <p>
        Version du 8 novembre 2026. EduBest est un espace dédié à la gestion
        d’un seul établissement scolaire en Algérie et aux échanges avec ses
        familles.
      </p>
      <h2>Votre établissement et vos contacts</h2>
      {!p && (
        <p role="alert">
          Coordonnées temporairement indisponibles. Réessayez avant de
          transmettre des données personnelles.
        </p>
      )}
      {p?.demo && (
        <p>Démonstration locale : utilisez uniquement des données fictives.</p>
      )}
      <p>
        <strong>
          {p?.legal_name || "Identité de l’établissement à renseigner"}
        </strong>
        <br />
        {p?.address || "Adresse à renseigner"}
      </p>
      <p>
        Contact :{" "}
        {p?.contact_email ? (
          <a href={`mailto:${p.contact_email}`}>{p.contact_email}</a>
        ) : (
          "à renseigner par la direction"
        )}
        . Demandes sur les données :{" "}
        {p?.privacy_email ? (
          <a href={`mailto:${p.privacy_email}`}>{p.privacy_email}</a>
        ) : (
          "contactez le secrétariat"
        )}
        .
      </p>
      <p>
        La direction de l’école détermine les informations nécessaires à la
        scolarité, les accès et les durées de conservation. Les informations de
        contact sont également consultables dans « Sécurité & confidentialité ».
      </p>
      <p>
        Contact technique Brainfor :{" "}
        <a href="mailto:contact@brainfor.net">contact@brainfor.net</a>. Ce
        contact technique ne remplace pas celui du responsable du traitement au
        sein de l’école.
      </p>
      <h2>Données et accès</h2>
      <p>
        Le service utilise les comptes, dossiers d’élèves, inscriptions,
        groupes, présences, paiements, documents et échanges nécessaires à la
        gestion scolaire. Les mots de passe sont hachés. Aucune donnée de carte
        bancaire n’est collectée. La direction gère l’école ; les enseignants
        accèdent à leurs groupes ; les parents et élèves aux dossiers associés à
        leur compte.
      </p>
      <p>
        Pour les mineurs, l’école vérifie les associations avec les
        représentants légaux et organise l’information des familles. N’ajoutez
        pas de données de santé ni de pièces d’identité dans les champs libres
        sans procédure adaptée.
      </p>
      <h2>Sécurité et conservation</h2>
      <p>
        Pour examiner les demandes d’inscription, l’école utilise le nom, le
        prénom, le téléphone, l’email et, selon le dossier, l’identité de
        l’élève, son niveau et les cours demandés. La direction et les personnes
        chargées des inscriptions vérifient la demande avant d’ouvrir l’accès.
        Une demande sans confirmation d’email est supprimée après sept jours.
        Les demandes confirmées sont supprimées après 90 jours à compter de leur
        confirmation si elles restent en attente, ou de leur décision si elles
        ont été traitées. Les comptes et dossiers scolaires créés suivent les
        règles de conservation de l’école.
      </p>
      <p>
        Les accès sont contrôlés côté serveur. La double authentification, la
        révocation des sessions, un journal de sécurité et la confirmation
        d’identité pour les opérations sensibles sont disponibles. Les sessions
        ont une durée maximale de sept jours et expirent après douze heures
        d’inactivité. Les journaux de sécurité et notifications sont conservés
        pendant 180 jours.
      </p>
      <p>
        {p?.retention ||
          "Les durées des dossiers scolaires, pièces financières et sauvegardes restent à définir par l’établissement avant l’ouverture réelle."}
      </p>
      <p>
        Le site utilise un cookie de session nécessaire à la connexion, sans
        publicité ni outil de suivi commercial intégré. L’application native
        conserve sa session dans le stockage sécurisé du système. Les
        notifications mobiles sont facultatives.
      </p>
      <h2>Vos demandes</h2>
      <p>
        Depuis « Sécurité & confidentialité », vous pouvez exporter les
        informations de votre compte et envoyer une demande d’accès, de
        rectification, d’effacement, de restriction, d’opposition ou de
        portabilité à la direction. Le traitement d’une demande dépend des
        données concernées et des obligations applicables ; supprimer un compte
        n’efface pas automatiquement un dossier scolaire ou financier.
      </p>
      <p>
        <Link href="/account-deletion">
          Demander la suppression du compte et des données, avec ou sans accès à
          l’application
        </Link>
        .
      </p>
      <h2>Hébergement et mise en service</h2>
      <p>
        {p?.hosting ||
          "Hébergement et prestataires à documenter avant l’ouverture réelle."}
      </p>
      <p>
        {p?.basis ||
          "Finalités et fondements de traitement à définir par l’établissement avant l’ouverture réelle."}
      </p>
      <p>
        L’hébergement, les prestataires email et notifications, les éventuels
        transferts internationaux et les sauvegardes doivent être documentés
        pour l’installation retenue. Les contrats, mentions légales et
        formalités de protection des données restent à finaliser avant toute
        utilisation avec de vrais dossiers. Ce logiciel ne constitue pas une
        certification de conformité ou une garantie de sécurité absolue.
      </p>
      <section dir="rtl" lang="ar">
        <h1>الخصوصية واستخدام إديوبيست</h1>
        <p>إديوبيست فضاء مخصص لمؤسسة تعليمية واحدة في الجزائر.</p>
        {p?.demo && <p>هذه نسخة تجريبية محلية. استخدم بيانات وهمية فقط.</p>}
        <p>
          {p?.legal_name}
          <br />
          {p?.address}
          <br />
          {p?.privacy_email}
        </p>
        <h2>البيانات والصلاحيات</h2>
        <p>
          تحدد إدارة المدرسة البيانات الضرورية للتمدرس وصلاحيات الوصول ومدد
          الاحتفاظ. يصل الأساتذة إلى مجموعاتهم والأولياء والتلاميذ إلى الملفات
          المرتبطة بحساباتهم. تتحقق المدرسة من هوية الممثل القانوني قبل ربط
          حسابه بملف الطفل. كلمات المرور مخزنة بشكل مجزأ ولا يجمع التطبيق بيانات
          البطاقات البنكية.
        </p>
        <h2>الأمان وحقوقكم</h2>
        <p>
          تراجع المدرسة بيانات الاتصال وبيانات التلميذ والدروس المطلوبة قبل فتح
          الحساب. تُحذف الطلبات التي لم يُؤكد بريدها بعد سبعة أيام. تُحذف
          الطلبات المؤكدة بعد 90 يومًا من تأكيدها إذا ظلت معلقة، أو من تاريخ
          القرار إذا عولجت. تخضع الحسابات والملفات الدراسية المنشأة لقواعد
          الاحتفاظ الخاصة بالمدرسة.
        </p>
        <p>
          تتوفر المصادقة الثنائية وإلغاء الجلسات وسجل الأمان وتأكيد الهوية
          للعمليات الحساسة. يمكنكم تصدير بيانات حسابكم وإرسال طلبات الخصوصية إلى
          الإدارة من صفحة الأمان والخصوصية. حذف الحساب لا يحذف تلقائيًا الملف
          الدراسي أو المالي.
        </p>
        <p>
          <Link href="/account-deletion">طلب حذف الحساب والبيانات</Link>. تحدد
          المؤسسة مدد الاحتفاظ وأغراض المعالجة والاستضافة ومقدمي الخدمات في
          الإشعار أعلاه. يمكنكم طلب توضيح من الإدارة.
        </p>
        <h2>قبل الاستخدام الفعلي</h2>
        <p>
          يجب استكمال الهوية القانونية وبيانات اتصال المدرسة والاستضافة والعقود
          والإجراءات اللازمة قبل إدخال ملفات حقيقية. هذه النسخة ليست شهادة
          امتثال ولا ضمانًا لأمان مطلق. الاتصال التقني: contact@brainfor.net.
        </p>
      </section>
    </main>
  );
}
