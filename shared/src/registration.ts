import { z } from "zod";

const personName = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .’'-]*$/u);
const phone = z
  .string()
  .trim()
  .max(32)
  .regex(/^\+?[0-9 .()-]+$/)
  .transform((value) => value.replace(/[ .()-]/g, "").replace(/^00/, "+"))
  .refine((value) => /^\+?\d{8,15}$/.test(value));
const groupIds = z
  .array(z.uuid())
  .max(10)
  .refine((ids) => new Set(ids).size === ids.length);

export const registrationInput = z
  .strictObject({
    role: z.enum(["STUDENT", "PARENT"]),
    student_kind: z.enum(["new", "existing"]),
    first_name: personName,
    last_name: personName,
    phone,
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    child_first_name: personName.optional(),
    child_last_name: personName.optional(),
    level: z.string().trim().max(100).optional(),
    group_ids: groupIds,
    acknowledged: z.literal(true),
    locale: z.enum(["fr", "ar"]),
  })
  .superRefine((value, ctx) => {
    const invalid = (field: string) =>
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: "Champ requis ou incohérent / حقل مطلوب أو غير متوافق",
      });
    if (value.role === "PARENT") {
      if (!value.child_first_name) invalid("child_first_name");
      if (!value.child_last_name) invalid("child_last_name");
    } else if (value.child_first_name || value.child_last_name) invalid("role");
    if (value.student_kind === "new") {
      if (!value.level) invalid("level");
    } else if (value.group_ids.length || value.level) invalid("student_kind");
  });

export type RegistrationInput = z.input<typeof registrationInput>;
export type RegistrationCourse = {
  id: string;
  name: string;
  subject: string;
  level: string;
  full: boolean;
};
export type RegistrationDossier = {
  id: string;
  name: string;
  level: string;
  has_parent: boolean;
  has_login: boolean;
};
export type RegistrationRequest = {
  id: string;
  role: "STUDENT" | "PARENT";
  student_kind: "new" | "existing";
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  child_first_name: string | null;
  child_last_name: string | null;
  level: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reason: string;
  can_resend: boolean;
  courses: (RegistrationCourse & { active: boolean })[];
};

export const registrationDecision = z.strictObject({
  identity_checked: z.literal(true),
  student_id: z.uuid().optional(),
  group_ids: groupIds,
});

export const registrationCopy = {
  title: ["Demande d’inscription", "طلب التسجيل"],
  intro: [
    "Vérifiez votre email, puis l’école examinera votre demande et vous indiquera la suite.",
    "أكد بريدك الإلكتروني، ثم تراجع المدرسة طلبك وتخبرك بالخطوة التالية.",
  ],
  student: ["Je suis élève", "أنا تلميذ"],
  parent: ["Je suis parent ou représentant légal", "أنا ولي أو ممثل قانوني"],
  newStudent: ["Nouvel élève", "تلميذ جديد"],
  existing: ["Élève déjà inscrit à l’école", "تلميذ مسجل في المدرسة"],
  firstName: ["Prénom", "الاسم"],
  lastName: ["Nom", "اللقب"],
  phone: ["Téléphone", "الهاتف"],
  email: ["Adresse email", "البريد الإلكتروني"],
  childFirstName: ["Prénom de l’élève", "اسم التلميذ"],
  childLastName: ["Nom de l’élève", "لقب التلميذ"],
  level: ["Niveau scolaire", "المستوى الدراسي"],
  courses: ["Cours souhaités", "الدروس المطلوبة"],
  coursesHelp: [
    "Sélectionnez jusqu’à dix cours. L’école confirmera les places et les groupes après vérification.",
    "اختر ما يصل إلى عشرة دروس. تؤكد المدرسة الأماكن والأفواج بعد المراجعة.",
  ],
  noCourses: [
    "Aucun cours ouvert actuellement. Contactez le secrétariat pour une nouvelle inscription.",
    "لا توجد دروس مفتوحة حاليًا. اتصل بالأمانة للتسجيل الجديد.",
  ],
  full: ["Complet", "مكتمل"],
  privacy: ["Consulter la confidentialité", "اطّلع على الخصوصية"],
  acknowledgement: [
    "J’ai lu la notice. Si je dépose une demande pour un enfant, je confirme être autorisé à le représenter.",
    "اطلعت على الإشعار. إذا قدمت طلبًا لطفل، أؤكد أنني مخوّل بتمثيله.",
  ],
  submit: ["Envoyer ma demande", "إرسال طلبي"],
  sent: [
    "Consultez votre boîte email et les courriers indésirables. Si un nouveau lien est nécessaire, EduBest vous l’enverra. Une fois votre email confirmé, l’école examinera la demande.",
    "راجع بريدك ومجلد الرسائل غير المرغوب فيها. سيرسل إديوبيست رابطًا إذا لزم الأمر. بعد تأكيد البريد، تراجع المدرسة الطلب.",
  ],
  unavailable: [
    "Les demandes en ligne sont momentanément indisponibles. Contactez le secrétariat.",
    "الطلبات عبر الإنترنت غير متاحة حاليًا. اتصل بالأمانة.",
  ],
  invalid: [
    "Vérifiez les champs obligatoires, le format du téléphone et les cours sélectionnés.",
    "تحقق من الحقول المطلوبة وصيغة الهاتف والدروس المختارة.",
  ],
  signIn: ["Retour à la connexion", "العودة إلى تسجيل الدخول"],
} as const;

export const registrationReviewCopy = {
  pending: ["À traiter", "قيد المراجعة"],
  history: ["Historique", "السجل"],
  catalog: ["Catalogue public", "كتالوج التسجيل"],
  refresh: ["Actualiser", "تحديث"],
  previous: ["Précédent", "السابق"],
  next: ["Suivant", "التالي"],
  empty: ["Aucune demande dans cette liste.", "لا توجد طلبات في هذه القائمة."],
  approved: ["Approuvée", "مقبولة"],
  rejected: ["Refusée", "مرفوضة"],
  review: ["Examiner la demande", "مراجعة الطلب"],
  child: ["Élève concerné", "التلميذ المعني"],
  groups: ["Cours à confirmer", "الدروس المراد تأكيدها"],
  noConfirmedGroups: [
    "Si vous validez maintenant, le dossier sera accepté sans affectation à un cours.",
    "إذا وافقت الآن، سيُقبل الملف دون تسجيل في أي درس.",
  ],
  inactive: ["Archivé", "مؤرشف"],
  find: ["Rechercher un dossier existant", "البحث عن ملف موجود"],
  search: ["Rechercher", "بحث"],
  noMatches: ["Aucun dossier correspondant.", "لا يوجد ملف مطابق."],
  useNew: ["Créer un nouveau dossier", "إنشاء ملف جديد"],
  linked: ["Accès déjà lié", "الوصول مرتبط مسبقًا"],
  checked: [
    "J’ai vérifié l’identité, les éventuels doublons et, si nécessaire, l’autorisation du représentant légal.",
    "تحققت من الهوية والملفات المكررة ومن تفويض الممثل القانوني عند الحاجة.",
  ],
  approve: ["Valider et envoyer l’accès", "الموافقة وإرسال الوصول"],
  reject: ["Refuser la demande", "رفض الطلب"],
  reason: ["Motif communiqué à la famille", "سبب يُرسل إلى الأسرة"],
  resend: ["Renvoyer l’activation", "إعادة إرسال التفعيل"],
  sent: [
    "Décision enregistrée. Email mis en file d’envoi.",
    "تم حفظ القرار ووضع البريد في قائمة الإرسال.",
  ],
  saved: ["Modification enregistrée.", "تم حفظ التعديل."],
  identity: [
    "La validation, le refus et les changements du catalogue nécessitent une confirmation récente de votre identité.",
    "تتطلب الموافقة والرفض وتعديلات الكتالوج تأكيدًا حديثًا لهويتك.",
  ],
  security: ["Ouvrir la sécurité du compte", "فتح أمان الحساب"],
  catalogueHelp: [
    "Ouvrez les cours que les familles peuvent demander. Les groupes archivés restent invisibles.",
    "افتح الدروس التي يمكن للعائلات طلبها. تظل الأفواج المؤرشفة مخفية.",
  ],
  open: ["Ouvrir aux inscriptions", "فتح التسجيل"],
  close: ["Fermer aux inscriptions", "إغلاق التسجيل"],
  visible: ["Visible", "ظاهر"],
  hidden: ["Masqué", "مخفي"],
} as const;
