import { theme } from "./theme";
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Linking,
  Platform,
  Share,
  KeyboardAvoidingView,
  AppState,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { MobileExports } from "./AccountTools";
import {
  User,
  adminRoles,
  financeRoles,
  dinars,
  labels as baseLabels,
  canView,
  pageLabel,
  password,
  passwordGuidance,
  PASSWORD_MAX_LENGTH,
} from "@edubest/shared";
import {
  api,
  raw,
  restore,
  setSession,
  WEBSITE,
  centimes,
  reviewAvailable,
  currentEnvironment,
  selectEnvironment,
  Environment,
} from "./api";
import MobileOverview from "./Overview";
import Brand from "./Brand";
import MobilePlanning from "./MobilePlanning";
import MobileSecurity from "./MobileSecurity";
import { RegistrationForm, MobileRegistrations } from "./Registration";
import { onSessionExpired } from "./api";
import { canRemoveSession, canRemoveTeacher } from "./admin-policy";
type Row = Record<string, any>;
const labels = {
  ...baseLabels,
  exports: { fr: "Exports & bilans", ar: "التصدير والتقارير" },
  delivery: { fr: "Suivi des envois", ar: "متابعة الإرسال" },
};
type Field = {
  key: string;
  label: string;
  value?: string;
  secure?: boolean;
  newPassword?: boolean;
  exactValue?: string;
  multiline?: boolean;
  numeric?: boolean;
  options?: { value: string; label: string }[];
  optional?: boolean;
  visibleWhen?: { key: string; value: string };
};
type Editor = {
  title: string;
  description?: string;
  fields: Field[];
  save: (values: Record<string, string>) => Promise<unknown>;
};
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
const status: Record<string, [string, string]> = {
  scheduled: ["Prévue", "مبرمجة"],
  completed: ["Terminée", "مكتملة"],
  cancelled: ["Annulée", "ملغاة"],
  present: ["Présent", "حاضر"],
  absent: ["Absent", "غائب"],
  late: ["Retard", "متأخر"],
  unmarked: ["Non renseigné", "غير مسجل"],
  payment: ["Versement", "دفع"],
  refund: ["Remboursement", "استرداد"],
  cash: ["Espèces", "نقد"],
  ccp: ["CCP", "حساب بريدي"],
  bank_transfer: ["Virement", "تحويل"],
  card_external: ["Carte externe", "بطاقة خارجية"],
  pending: ["En attente", "قيد الانتظار"],
  accepted: ["Accepté", "مقبول"],
  rejected: ["Refusé", "مرفوض"],
};
const day = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" });
const month = () => day().slice(0, 7);
const key = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
export default function App() {
  return (
    <SafeAreaProvider>
      <EduBest />
    </SafeAreaProvider>
  );
}
function EduBest() {
  const [environment, setEnvironment] =
    useState<Environment>(currentEnvironment());
  const request = useRef(0);
  const [unread, setUnread] = useState(0);
  const [activationRequired, setActivationRequired] = useState(false);
  const [planningRevision, setPlanningRevision] = useState(0);
  const [loginMfa, setLoginMfa] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState(month());
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const [user, setUser] = useState<User | null>(null),
    [ar, setAr] = useState(false),
    [boot, setBoot] = useState(true),
    [page, setPage] = useState("dashboard"),
    [rows, setRows] = useState<Row[]>([]),
    [home, setHome] = useState<Row>({}),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [editor, setEditor] = useState<Editor | null>(null),
    [detail, setDetail] = useState<{
      kind: string;
      row: Row;
      rows: Row[];
    } | null>(null),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState(""),
    [cash, setCash] = useState<Row | null>(null),
    [lookup, setLookup] = useState<{
      students: Row[];
      groups: Row[];
      users: Row[];
    }>({ students: [], groups: [], users: [] });
  const t = (f: string, a: string) => (ar ? a : f),
    tr = (v: string) => status[v]?.[ar ? 1 : 0] ?? v,
    money = (v: number) => dinars(v ?? 0, ar ? "ar" : "fr"),
    date = (v: string) =>
      new Date(v).toLocaleString(ar ? "ar-DZ" : "fr-DZ", {
        timeZone: "Africa/Algiers",
        dateStyle: "medium",
        timeStyle: "short",
        hourCycle: "h23",
      });
  const admin = !!user && adminRoles.includes(user.role),
    finance = !!user && financeRoles.includes(user.role),
    teacher = user?.role === "TEACHER",
    teach = admin || teacher,
    family = user?.role === "PARENT" || user?.role === "STUDENT";
  function clearPrivateState() {
    request.current++;
    setUser(null);
    setRows([]);
    setHome({});
    setCash(null);
    setUnread(0);
    setLookup({ students: [], groups: [], users: [] });
    setDetail(null);
    setEditor(null);
    setPage("dashboard");
    setMenu(false);
    setActivationRequired(false);
  }
  useEffect(() => onSessionExpired(clearPrivateState), []);
  async function enter(u: User) {
    const security = await api("security/account");
    const required = !!security.mfa_required && !security.mfa_enabled;
    setActivationRequired(required);
    setRegistering(false);
    setPage(
      required
        ? "account"
        : u.role === "SECRETARY"
          ? "registrations"
          : "dashboard",
    );
    setUser(u);
    setAr(u.locale === "ar");
  }
  useEffect(() => {
    restore()
      .then(async (s) => {
        if (s) {
          try {
            const u = await api("auth/me");
            await enter(u);
          } catch (e) {
            setError((e as Error).message);
          }
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => {
        setEnvironment(currentEnvironment());
        setBoot(false);
      });
  }, []);
  async function load() {
    if (!user) return;
    const seq = ++request.current;
    setLoading(true);
    setError("");
    try {
      if (["account", "exports", "sessions", "registrations"].includes(page)) {
        if (page === "sessions") setPlanningRevision((v) => v + 1);
        setLoading(false);
        return;
      }
      const r = await api(
        page === "payroll" ? `payroll?month=${payrollMonth}` : page,
      );
      if (seq !== request.current) return;
      page === "dashboard"
        ? setHome(r)
        : setRows(page === "delivery" ? r.jobs : r);
      if (page === "payments" && finance) setCash(await api("cash"));
      if (teach || finance) {
        const [students, groups, users] = await Promise.all([
          api("students"),
          api("groups"),
          admin ? api("users") : Promise.resolve([]),
        ]);
        if (seq === request.current) setLookup({ students, groups, users });
      }
    } catch (e) {
      if (seq === request.current) setError((e as Error).message);
    } finally {
      if (seq === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [user, page, payrollMonth]);
  useEffect(() => {
    if (!user || activationRequired || page !== "dashboard") return;
    let cancelled = false;
    const timer = setInterval(async () => {
      if (AppState.currentState !== "active") return;
      const seq = request.current;
      try {
        const value = await api("dashboard");
        if (!cancelled && seq === request.current) setHome(value);
      } catch {
        /* Keep the last agenda until the next foreground/manual refresh. */
      }
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user?.id, page]);
  useEffect(() => {
    const listener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const view = String(
          response.notification.request.content.data?.view ?? "notifications",
        );
        nav(user && canView(user.role, view) ? view : "notifications");
      },
    );
    const active = AppState.addEventListener("change", (s) => {
      if (s === "active" && user) void load();
    });
    return () => {
      listener.remove();
      active.remove();
    };
  }, [user, page]);
  useEffect(() => {
    if (!user || !canView(user.role, "notifications")) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const all = await api("notifications");
        if (!cancelled) {
          setUnread(all.filter((r: Row) => !r.seen).length);
          if (page === "notifications") setRows(all);
        }
      } catch {}
    };
    const received = Notifications.addNotificationReceivedListener(() => {
      void refresh();
      if (page === "notifications" || page === "dashboard") void load();
    });
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      received.remove();
    };
  }, [user?.id, page]);
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setMessage(t("Enregistré", "تم الحفظ"));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function nav(p: string) {
    if (user && !canView(user.role, p))
      p = user.role === "SECRETARY" ? "registrations" : "dashboard";
    if (activationRequired && p !== "account") {
      setError(
        t(
          "Activez la double authentification dans Mon profil.",
          "فعّل المصادقة الثنائية في ملفك الشخصي.",
        ),
      );
      p = "account";
    }
    request.current++;
    setPage(p);
    setRows([]);
    setSearch("");
    setMenu(false);
    setDetail(null);
    setMessage("");
  }
  const options = (r: Row[]) => r.map((x) => ({ value: x.id, label: x.name }));
  const field = (
    key: string,
    f: string,
    a: string,
    value?: string,
    extra: Partial<Field> = {},
  ): Field => ({ key, label: t(f, a), value, ...extra });
  const choose = (
    key: string,
    f: string,
    a: string,
    list: Row[],
    v?: string,
    optional = false,
  ) => field(key, f, a, v, { options: options(list), optional });
  const form = (title: string, fields: Field[], save: Editor["save"]) =>
    setEditor({ title, fields, save });
  function studentForm(r: Row = {}) {
    form(
      t("Dossier élève", "ملف التلميذ"),
      [
        field("name", "Nom complet", "الاسم الكامل", r.name),
        field("level", "Niveau", "المستوى", r.level, { optional: true }),
        field("phone", "Téléphone", "الهاتف", r.phone, { optional: true }),
        field(
          "birth_date",
          "Naissance AAAA-MM-JJ",
          "الميلاد YYYY-MM-DD",
          r.birth_date,
          { optional: true },
        ),
        choose(
          "parent_id",
          "Compte parent",
          "حساب الولي",
          lookup.users.filter((x) => x.role === "PARENT" && x.active),
          r.parent_id,
          true,
        ),
        choose(
          "user_id",
          "Compte élève",
          "حساب التلميذ",
          lookup.users.filter(
            (x) =>
              x.role === "STUDENT" &&
              x.active &&
              (!x.student_id || x.student_id === r.id),
          ),
          r.user_id,
          true,
        ),
      ],
      (v) =>
        api(r.id ? `students/${r.id}` : "students", r.id ? "PATCH" : "POST", {
          ...v,
          parent_id: v.parent_id || null,
          user_id: v.user_id || null,
          birth_date: v.birth_date || null,
        }),
    );
  }
  function groupForm(r: Row = {}) {
    form(
      t("Groupe de cours", "مجموعة دروس"),
      [
        field("name", "Nom", "الاسم", r.name),
        field("subject", "Matière", "المادة", r.subject),
        field("level", "Niveau", "المستوى", r.level, { optional: true }),
        choose(
          "teacher_id",
          "Enseignant",
          "الأستاذ",
          lookup.users.filter((x) => x.role === "TEACHER" && x.active),
          r.teacher_id,
          true,
        ),
        field("room", "Salle", "القاعة", r.room, { optional: true }),
        field("capacity", "Capacité", "السعة", String(r.capacity ?? 20), {
          numeric: true,
        }),
        field(
          "fee",
          "Tarif mensuel DA",
          "التعريفة الشهرية دج",
          String((r.fee_centimes ?? 0) / 100),
          { numeric: true },
        ),
        field("pay_mode", "Rémunération", "الأجر", r.pay_mode ?? "session", {
          options: [
            { value: "session", label: t("Par séance", "لكل حصة") },
            { value: "hour", label: t("Par heure", "لكل ساعة") },
            {
              value: "percent",
              label: t("% des encaissements", "نسبة التحصيل"),
            },
          ],
        }),
        field(
          "pay_value",
          "Rémunération enseignant",
          "المبلغ دج أو النسبة",
          String((r.pay_value ?? 0) / 100),
          { numeric: true },
        ),
      ],
      (v) =>
        api(r.id ? `groups/${r.id}` : "groups", r.id ? "PATCH" : "POST", {
          name: v.name,
          subject: v.subject,
          level: v.level,
          room: v.room,
          teacher_id: v.teacher_id || null,
          capacity: Number(v.capacity),
          fee_centimes: centimes(v.fee),
          pay_mode: v.pay_mode,
          pay_value: centimes(v.pay_value),
        }),
    );
  }
  function removeRecord(kind: "groups" | "sessions" | "users", row: Row) {
    if (!admin || !user) return;
    if (kind === "sessions" && !canRemoveSession(user.role, row)) return;
    if (kind === "users" && !canRemoveTeacher(user.role, row)) return;
    const title =
      kind === "groups"
        ? t("Supprimer le cours", "حذف الدرس")
        : kind === "sessions"
          ? t("Supprimer cette séance", "حذف هذه الحصة")
          : t("Supprimer cet enseignant", "حذف هذا الأستاذ");
    const description =
      kind === "groups"
        ? t(
            "Le cours sera retiré des groupes actifs et ses séances futures non commencées seront annulées. Les présences, inscriptions, échéances et rémunérations passées restent conservées.",
            "ستُسحب المجموعة من المجموعات النشطة وتُلغى حصصها المستقبلية التي لم تبدأ. تُحفظ سجلات الحضور والتسجيل والمستحقات والأجور السابقة.",
          )
        : kind === "sessions"
          ? t(
              "Seule cette séance future sera annulée. Les autres séances et l’historique restent conservés.",
              "ستُلغى هذه الحصة المستقبلية فقط. تُحفظ الحصص الأخرى والسجل.",
            )
          : t(
              "L’accès de cet enseignant sera désactivé et ses sessions révoquées. Ses cours futurs resteront à réaffecter. L’historique des présences et rémunérations reste conservé.",
              "سيُعطّل حساب الأستاذ وتُلغى جلسات اتصاله. يجب تعيين أستاذ آخر لدروسه المستقبلية. تُحفظ سجلات الحضور والأجور.",
            );
    setEditor({
      title,
      description: `${row.name || row.group_name || ""}\n${description}`,
      fields: [
        field(
          "confirmation",
          "Saisissez SUPPRIMER pour confirmer",
          "اكتب SUPPRIMER للتأكيد",
          undefined,
          { exactValue: "SUPPRIMER" },
        ),
      ],
      save: async () => {
        await api(`${kind}/${row.id}`, "DELETE");
        setDetail(null);
        setPlanningRevision((v) => v + 1);
      },
    });
  }
  function sessionForm(r: Row = {}, availableGroups: Row[] = lookup.groups) {
    const local = (v: string) =>
      new Date(v)
        .toLocaleString("sv-SE", { timeZone: "Africa/Algiers" })
        .slice(0, 16);
    form(
      t("Planifier une séance", "جدولة حصة"),
      [
        choose("group_id", "Groupe", "المجموعة", availableGroups, r.group_id),
        field(
          "start",
          "Début AAAA-MM-JJ HH:MM (Alger)",
          "البداية YYYY-MM-DD HH:MM (الجزائر)",
          r.starts_at ? local(r.starts_at) : `${day()} 09:00`,
        ),
        field(
          "end",
          "Fin AAAA-MM-JJ HH:MM (Alger)",
          "النهاية YYYY-MM-DD HH:MM (الجزائر)",
          r.ends_at ? local(r.ends_at) : `${day()} 10:00`,
        ),
        field("room", "Salle", "القاعة", r.room, { optional: true }),
        field("notes", "Notes", "ملاحظات", r.notes, {
          optional: true,
          multiline: true,
        }),
      ],
      (v) => {
        const iso = (s: string) => {
          if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s))
            throw new Error(
              t("Format de date invalide", "تنسيق تاريخ غير صحيح"),
            );
          return new Date(`${s.replace(" ", "T")}:00+01:00`).toISOString();
        };
        return api(
          r.id ? `sessions/${r.id}` : "sessions",
          r.id ? "PATCH" : "POST",
          {
            group_id: v.group_id,
            starts_at: iso(v.start),
            ends_at: iso(v.end),
            room: v.room,
            notes: v.notes,
          },
        );
      },
    );
  }
  function invoiceForm() {
    form(
      t("Nouvelle échéance", "مستحق جديد"),
      [
        choose("student_id", "Élève", "التلميذ", lookup.students),
        choose(
          "group_id",
          "Groupe facultatif",
          "المجموعة اختياري",
          lookup.groups,
          undefined,
          true,
        ),
        field("label", "Libellé", "الوصف"),
        field("amount", "Montant DA", "المبلغ دج", undefined, {
          numeric: true,
        }),
        field(
          "due_date",
          "Date limite AAAA-MM-JJ",
          "تاريخ الاستحقاق YYYY-MM-DD",
          day(),
        ),
      ],
      (v) =>
        api("invoices", "POST", {
          student_id: v.student_id,
          group_id: v.group_id || null,
          label: v.label,
          amount_centimes: centimes(v.amount),
          due_date: v.due_date,
        }),
    );
  }
  function paymentForm(r: Row) {
    const id = key();
    form(
      t("Encaisser un versement", "تحصيل دفع"),
      [
        field(
          "amount",
          `Montant DA · solde ${r.balance_centimes / 100}`,
          `المبلغ دج · الرصيد ${r.balance_centimes / 100}`,
          String(r.balance_centimes / 100),
          { numeric: true },
        ),
        field("method", "Mode", "الوسيلة", "cash", {
          options: ["cash", "ccp", "bank_transfer", "card_external"].map(
            (value) => ({ value, label: tr(value) }),
          ),
        }),
        field(
          "reference",
          "Référence hors espèces",
          "المرجع لغير النقد",
          undefined,
          { optional: true },
        ),
      ],
      (v) =>
        api(
          "payments",
          "POST",
          {
            invoice_id: r.id,
            amount_centimes: centimes(v.amount),
            method: v.method,
            reference: v.reference,
          },
          id,
        ),
    );
  }
  function refundForm(r: Row) {
    const id = key();
    form(
      t("Rembourser le versement", "استرداد الدفع"),
      [
        field(
          "amount",
          "Montant DA",
          "المبلغ دج",
          String(r.amount_centimes / 100),
          { numeric: true },
        ),
        field("reference", "Motif / référence", "السبب / المرجع"),
      ],
      (v) =>
        api(
          "refunds",
          "POST",
          {
            payment_id: r.id,
            amount_centimes: centimes(v.amount),
            reference: v.reference,
          },
          id,
        ),
    );
  }
  async function attendance(r: Row) {
    try {
      setDetail({
        kind: "attendance",
        row: r,
        rows: await api(`sessions/${r.id}/attendance`),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function roster(r: Row) {
    try {
      setDetail({
        kind: "roster",
        row: r,
        rows: await api(`groups/${r.id}/students`),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function download(r: Row) {
    await action(async () => {
      const response = await raw(`materials/${r.id}`);
      if (!response.ok)
        throw new Error(t("Document indisponible", "الوثيقة غير متاحة"));
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(new Blob([bytes], { type: r.mime }));
        const a = document.createElement("a");
        a.href = url;
        a.download = r.filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const safe = r.filename.replace(/[^\p{L}\p{N}._-]/gu, "_");
        const file = new File(Paths.cache, `${Date.now()}-${safe}`);
        file.create();
        file.write(bytes);
        if (await Sharing.isAvailableAsync())
          await Sharing.shareAsync(file.uri, { mimeType: r.mime });
        else
          throw new Error(
            t(
              "Le partage est indisponible sur cet appareil",
              "المشاركة غير متاحة على الجهاز",
            ),
          );
        file.delete();
      }
    });
  }
  function documentForm() {
    form(
      t("Partager un document", "مشاركة وثيقة"),
      [
        choose("group_id", "Groupe", "المجموعة", lookup.groups),
        field("title", "Titre", "العنوان"),
      ],
      async (v) => {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "image/png", "image/jpeg", "text/plain"],
          copyToCacheDirectory: true,
        });
        if (result.canceled)
          throw new Error(t("Sélection annulée", "تم إلغاء الاختيار"));
        const asset = result.assets[0];
        const file = new File(asset.uri);
        if ((file.size ?? 0) > 5_000_000)
          throw new Error(t("Maximum 5 Mo", "5 ميغابايت كحد أقصى"));
        const base64 = await file.base64();
        return api("materials", "POST", {
          group_id: v.group_id,
          title: v.title,
          filename: asset.name,
          mime: asset.mimeType ?? "text/plain",
          base64,
        });
      },
    );
  }
  function invite() {
    form(
      t("Inviter un utilisateur", "دعوة مستخدم"),
      [
        field("name", "Nom", "الاسم"),
        field("email", "Email", "البريد"),
        field("role", "Rôle", "الدور", "TEACHER", {
          options: (user?.role === "OWNER"
            ? [
                "MANAGER",
                "CASHIER",
                "SECRETARY",
                "TEACHER",
                "PARENT",
                "STUDENT",
              ]
            : ["CASHIER", "SECRETARY", "TEACHER", "PARENT", "STUDENT"]
          ).map((value) => ({ value, label: value })),
        }),
        {
          ...choose(
            "student_id",
            "Dossier existant sans compte (vide = nouveau)",
            "ملف موجود دون حساب (فارغ = جديد)",
            lookup.students.filter((s) => !s.user_id),
            undefined,
            true,
          ),
          visibleWhen: { key: "role", value: "STUDENT" },
        },
      ],
      (v) =>
        api("auth/invite", "POST", {
          ...v,
          student_id: v.role === "STUDENT" ? v.student_id || null : null,
          locale: ar ? "ar" : "fr",
        }),
    );
  }
  async function pushes() {
    await action(async () => {
      if (Platform.OS === "web" || !Device.isDevice)
        throw new Error(
          t("Un téléphone physique est nécessaire", "يلزم هاتف فعلي"),
        );
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
      if (!projectId)
        throw new Error(
          t(
            "Les notifications push seront disponibles après la configuration du service mobile. Votre boîte de notifications fonctionne déjà.",
            "تتوفر التنبيهات بعد إعداد خدمة الهاتف. صندوق الإشعارات يعمل الآن.",
          ),
        );
      if (Platform.OS === "android")
        await Notifications.setNotificationChannelAsync("default", {
          name: "EduBest",
          importance: Notifications.AndroidImportance.HIGH,
        });
      let permission = await Notifications.getPermissionsAsync();
      if (permission.status !== "granted")
        permission = await Notifications.requestPermissionsAsync();
      if (permission.status !== "granted")
        throw new Error(
          t(
            "Permission refusée. Vos messages restent accessibles ici.",
            "تم رفض الإذن. رسائلك متاحة هنا.",
          ),
        );
      const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
        .data;
      await api("devices", "POST", { token });
      const storage = await import("expo-secure-store");
      await storage.setItemAsync("edubest_push", token);
    });
  }
  async function invoicePdf(r: Row) {
    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const html = `<!doctype html><html lang="${ar ? "ar" : "fr"}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"/><style>body{font-family:Arial;padding:36px;color:#193A4E}h1{border-bottom:3px solid #6D9EBB;padding-bottom:20px}p{font-size:18px;line-height:1.6}</style></head><body><h1>EduBest — ${esc(t("Échéance de paiement", "مستحق دفع"))}</h1><h2>${esc(r.student_name)}</h2><p>${esc(r.label)}</p><p>${esc(t("Date limite", "آخر أجل"))} : ${esc(r.due_date)}</p><p>${esc(t("Montant", "المبلغ"))} : ${esc(money(r.amount_centimes))}</p><p>${esc(t("Payé / solde", "المدفوع / المتبقي"))} : ${esc(money(r.paid_centimes))} / ${esc(money(r.balance_centimes))}</p><p>${esc(t("Suivi des frais scolaires, sans valeur de facture fiscale.", "وثيقة متابعة رسوم مدرسية وليست فاتورة ضريبية."))}</p></body></html>`;
    if (Platform.OS === "web") {
      await Print.printAsync({ html });
      return;
    }
    const pdf = await Print.printToFileAsync({ html });
    try {
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(pdf.uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
        });
      else await Print.printAsync({ uri: pdf.uri });
    } finally {
      const file = new File(pdf.uri);
      if (file.exists) file.delete();
    }
  }
  async function logout() {
    setBusy(true);
    try {
      if (Platform.OS !== "web") {
        const storage = await import("expo-secure-store");
        const token = await storage.getItemAsync("edubest_push");
        if (token) {
          try {
            await api("devices", "DELETE", { token });
          } catch {}
          await storage.deleteItemAsync("edubest_push");
        }
      }
      await api("auth/logout", "POST", {});
    } catch {
      setError(
        t(
          "Déconnexion locale effectuée. Le serveur n’a pas pu être joint.",
          "تم تسجيل الخروج محليًا. تعذر الاتصال بالخادم.",
        ),
      );
    } finally {
      await setSession("");
      clearPrivateState();
      setBusy(false);
    }
  }
  const menus = Object.keys(labels).filter(
    (p) => p !== "settings" && !!user && canView(user.role, p),
  );
  const shown = rows.filter((r) =>
    Object.values(r).some(
      (v) =>
        typeof v === "string" && v.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  const rtl = ar
    ? { writingDirection: "rtl" as const, textAlign: "right" as const }
    : {};
  const button = (label: string, onPress: () => void, secondary = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={[s.button, secondary && s.secondary, busy && s.disabled]}
    >
      <Text style={[s.buttonText, secondary && s.secondaryText]}>{label}</Text>
    </Pressable>
  );
  if (boot)
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Brand mark width={90} />
          <ActivityIndicator color={theme.navy} />
        </View>
      </SafeAreaView>
    );
  if (!user)
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={s.login}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              onPress={() => setAr(!ar)}
              style={{ alignSelf: "flex-end" }}
            >
              <Text style={s.link}>{ar ? "Français" : "العربية"}</Text>
            </Pressable>
            <Brand
              width={240}
              style={{ marginTop: 25, marginBottom: 28, maxWidth: "100%" }}
            />
            {registering ? (
              <RegistrationForm ar={ar} onBack={() => setRegistering(false)} />
            ) : (
              <>
                {Constants.expoConfig?.extra?.internalTest && (
                  <Text style={s.pill}>
                    {t(
                      "Version d’essai — service EduBest en ligne",
                      "نسخة اختبار — خدمة EduBest عبر الإنترنت",
                    )}
                  </Text>
                )}
                <Text style={[s.hero, rtl]}>
                  {t("Bienvenue chez EduBest.", "مرحبًا بكم في إديوبيست.")}
                </Text>
                <Text style={[s.muted, rtl]}>
                  {t(
                    "Un espace pour les cours, les familles et toute votre équipe.",
                    "مساحة للدروس والعائلات وفريقك.",
                  )}
                </Text>
                {error && (
                  <Text accessibilityRole="alert" style={s.error}>
                    {error}
                  </Text>
                )}
                <Login
                  key={environment}
                  ar={ar}
                  busy={busy}
                  mfaRequired={loginMfa}
                  submit={(v) =>
                    void action(async () => {
                      const r = await api("auth/login", "POST", v);
                      if (r.mfa_required) {
                        setLoginMfa(true);
                        throw new Error(
                          t(
                            "Saisissez un nouveau code de double authentification ou de secours.",
                            "أدخل رمز مصادقة ثنائية جديدًا أو رمز استرداد.",
                          ),
                        );
                      }
                      setLoginMfa(false);
                      await setSession(r.token);
                      const u = await api("auth/me");
                      await enter(u);
                    })
                  }
                />
                {reviewAvailable && (
                  <>
                    <Text
                      style={[s.small, { textAlign: "center", marginTop: 16 }]}
                    >
                      {environment === "review"
                        ? t(
                            "DÉMONSTRATION — données fictives uniquement. Emails et push externes désactivés.",
                            "عرض توضيحي — بيانات وهمية فقط. إرسال البريد والإشعارات الخارجية معطّل.",
                          )
                        : t(
                            "Vous vous connectez à votre école.",
                            "أنت تتصل بمدرستك.",
                          )}
                    </Text>
                    {button(
                      environment === "review"
                        ? t("Revenir à mon école", "العودة إلى مدرستي")
                        : t("Essayer la démonstration", "تجربة العرض التوضيحي"),
                      () =>
                        void action(async () => {
                          const next =
                            environment === "review" ? "school" : "review";
                          await selectEnvironment(next);
                          setEnvironment(next);
                          setLoginMfa(false);
                          setError("");
                          setMessage("");
                        }),
                      true,
                    )}
                  </>
                )}
                {button(
                  t("Mot de passe oublié", "نسيت كلمة المرور"),
                  () =>
                    form(
                      t("Récupérer mon accès", "استعادة الوصول"),
                      [field("email", "Email", "البريد")],
                      async (v) => {
                        await api("auth/forgot", "POST", v);
                        setMessage(
                          t(
                            "Si le compte existe, un email a été envoyé.",
                            "إذا كان الحساب موجودًا، تم إرسال بريد.",
                          ),
                        );
                      },
                    ),
                  true,
                )}
                {environment === "school" &&
                  button(
                    t("Demander une inscription", "طلب التسجيل"),
                    () => {
                      setRegistering(true);
                      setError("");
                    },
                    true,
                  )}
                {message && <Text style={s.success}>{message}</Text>}
                <Pressable onPress={() => void Linking.openURL(`${WEBSITE}/`)}>
                  <Text
                    style={[s.link, { textAlign: "center", marginTop: 20 }]}
                  >
                    {t("Découvrir mon école", "اكتشف مدرستي")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void Linking.openURL(`${WEBSITE}/legal`)}
                >
                  <Text
                    style={[s.small, { textAlign: "center", marginTop: 25 }]}
                  >
                    {t("Confidentialité & conditions", "الخصوصية والشروط")}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        {editor && (
          <EditorModal
            editor={editor}
            ar={ar}
            close={() => setEditor(null)}
            save={async (v) => {
              await editor.save(v);
              setEditor(null);
            }}
          />
        )}
      </SafeAreaView>
    );
  return (
    <SafeAreaView
      style={[s.safe, wide && { flexDirection: ar ? "row-reverse" : "row" }]}
    >
      <StatusBar style="dark" />
      {wide && (
        <View style={r.sidebar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              "EduBest — tableau de bord",
              "EduBest — لوحة التحكم",
            )}
            onPress={() => nav("dashboard")}
            style={r.sideBrand}
          >
            <Brand light width={186} />
          </Pressable>
          <Text style={r.sideSchool}>{user.school}</Text>
          <Text style={r.sideCaption}>
            {t("VOTRE ÉTABLISSEMENT", "مؤسستك")}
          </Text>
          <ScrollView style={{ flex: 1 }}>
            {menus.map((p) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: page === p }}
                key={p}
                onPress={() => nav(p)}
                style={[r.sideItem, page === p && r.sideActive]}
              >
                <Text style={[r.sideItemIcon, page === p && r.sideActiveText]}>
                  {p === "dashboard"
                    ? "▦"
                    : p === "sessions"
                      ? "◷"
                      : p === "students"
                        ? "◉"
                        : p === "payments"
                          ? "↗"
                          : "▤"}
                </Text>
                <Text style={[r.sideItemText, page === p && r.sideActiveText]}>
                  {pageLabel(p, user.role, ar ? "ar" : "fr")}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            style={r.sideProfile}
            onPress={() => nav("account")}
          >
            <Text style={r.sideAvatar}>{user.name.slice(0, 1)}</Text>
            <View>
              <Text style={r.sideName}>{user.name}</Text>
              <Text style={r.sideRole}>{t("Mon profil", "ملفي الشخصي")}</Text>
            </View>
            <Text style={r.sideChevron}>›</Text>
          </Pressable>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        {environment === "review" && (
          <Text
            accessibilityRole="text"
            style={[s.pill, { textAlign: "center", margin: 8 }]}
          >
            {t("Démonstration — données fictives", "عرض توضيحي — بيانات وهمية")}
          </Text>
        )}
        <View style={s.top}>
          <View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(
                "EduBest — tableau de bord",
                "EduBest — لوحة التحكم",
              )}
              onPress={() => nav("dashboard")}
            >
              <Brand width={150} style={{ marginBottom: 5 }} />
            </Pressable>
            <Text numberOfLines={1} style={s.small}>
              {user.school}
            </Text>
          </View>
          <View style={s.inline}>
            <Pressable onPress={() => setAr(!ar)}>
              <Text style={s.link}>{ar ? "FR" : "ع"}</Text>
            </Pressable>
            {wide ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => nav("account")}
              >
                <Text style={r.headerAvatar}>{user.name.slice(0, 1)}</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Menu", "القائمة")}
                onPress={() => setMenu(true)}
              >
                <Text style={s.menuIcon}>☰</Text>
              </Pressable>
            )}
          </View>
        </View>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void load()}
              tintColor={theme.action}
            />
          }
          contentContainerStyle={[
            s.content,
            wide && { maxWidth: 1400, padding: 28 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[s.small, rtl]}>
            {day()} · {user.name}
          </Text>
          <Text style={[s.title, rtl]}>
            {page === "account"
              ? t("Mon profil", "ملفي الشخصي")
              : page === "dashboard"
                ? t("Tableau de bord", "لوحة التحكم")
                : pageLabel(page, user.role, ar ? "ar" : "fr")}
          </Text>
          {!user.verified && (
            <View style={s.warning}>
              <Text style={s.text}>
                {t(
                  "Vérifiez votre email pour modifier les données.",
                  "أكد بريدك لتعديل البيانات.",
                )}
              </Text>
              {button(
                t("Renvoyer le lien", "إعادة إرسال الرابط"),
                () => void action(() => api("auth/resend", "POST", {})),
                true,
              )}
              {button(
                t("J’ai vérifié mon email", "أكدت بريدي"),
                () => void action(async () => setUser(await api("auth/me"))),
                true,
              )}
            </View>
          )}
          {error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          {message && (
            <Pressable onPress={() => setMessage("")}>
              <Text style={s.success}>{message} ×</Text>
            </Pressable>
          )}
          {page === "exports" && admin && <MobileExports ar={ar} />}
          {page === "registrations" && canView(user.role, page) && (
            <MobileRegistrations
              ar={ar}
              admin={admin}
              onSecurity={() => nav("account")}
            />
          )}
          {page === "payroll" && (
            <View style={s.card}>
              <Text>{t("Mois AAAA-MM", "الشهر YYYY-MM")}</Text>
              <TextInput
                style={s.input}
                value={payrollMonth}
                onChangeText={setPayrollMonth}
              />
              <Text>
                {t(
                  "Calcul sur les séances terminées ou les encaissements nets selon le contrat. Les anciens tarifs restent historisés.",
                  "الحساب حسب الحصص المنتهية أو صافي التحصيل. التعريفات السابقة محفوظة.",
                )}
              </Text>
            </View>
          )}
          {page === "dashboard" && (
            <MobileOverview
              data={home}
              user={user}
              ar={ar}
              wide={wide}
              nav={nav}
              openSession={(r) =>
                setDetail({ kind: "session", row: r, rows: [] })
              }
              openNotice={(r) =>
                setDetail({ kind: "notice", row: r, rows: [] })
              }
              onStudent={() => studentForm()}
              onSession={() => sessionForm()}
              onAttendance={(r) => void attendance(r)}
            />
          )}
          {page !== "dashboard" &&
            page !== "account" &&
            page !== "exports" &&
            page !== "registrations" &&
            page !== "sessions" && (
              <TextInput
                style={s.input}
                placeholder={t("Rechercher…", "بحث…")}
                value={search}
                onChangeText={setSearch}
                accessibilityLabel={t("Rechercher", "بحث")}
              />
            )}
          {page === "students" &&
            admin &&
            button(t("+ Nouvel élève", "+ تلميذ جديد"), () => studentForm())}
          {page === "groups" &&
            admin &&
            button(t("+ Nouveau groupe", "+ مجموعة جديدة"), () => groupForm())}
          {page === "sessions" && (
            <MobilePlanning
              user={user}
              ar={ar}
              revision={planningRevision}
              onNew={(g) => sessionForm({}, g)}
              onEdit={(r, g) => sessionForm(r, g)}
              onAttendance={(r) => void attendance(r)}
              onOpen={(r) => setDetail({ kind: "session", row: r, rows: [] })}
            />
          )}
          {page === "invoices" && finance && (
            <>
              {button(t("+ Nouvelle échéance", "+ مستحق جديد"), invoiceForm)}
              {button(
                t("Facturation mensuelle", "الفوترة الشهرية"),
                () =>
                  form(
                    t("Facturer un groupe", "فوترة مجموعة"),
                    [
                      choose("group_id", "Groupe", "المجموعة", lookup.groups),
                      field("month", "Mois AAAA-MM", "الشهر YYYY-MM", month()),
                      field(
                        "due_date",
                        "Date limite AAAA-MM-JJ",
                        "الاستحقاق YYYY-MM-DD",
                        day(),
                      ),
                    ],
                    (v) => api("invoices/generate", "POST", v),
                  ),
                true,
              )}
            </>
          )}
          {page === "users" &&
            admin &&
            button(t("+ Inviter", "+ دعوة"), invite)}
          {page === "materials" &&
            teach &&
            button(t("+ Document", "+ وثيقة"), documentForm)}
          {page === "announcements" &&
            teach &&
            button(t("+ Annonce", "+ إعلان"), () =>
              form(
                t("Publier une annonce", "نشر إعلان"),
                [
                  choose(
                    "group_id",
                    "Groupe (vide = centre)",
                    "المجموعة (فارغة = المركز)",
                    lookup.groups,
                    undefined,
                    !teacher,
                  ),
                  field("title", "Titre", "العنوان"),
                  field("body", "Message", "الرسالة", undefined, {
                    multiline: true,
                  }),
                ],
                (v) =>
                  api("announcements", "POST", {
                    ...v,
                    group_id: v.group_id || null,
                  }),
              ),
            )}
          {page === "notifications" &&
            button(
              t("Tout marquer comme lu", "تحديد الكل كمقروء"),
              () => void action(() => api("notifications/read", "POST", {})),
              true,
            )}
          {page === "payments" && finance && cash && (
            <View style={s.featureCard}>
              <Text style={s.cardTitle}>
                {t("Caisse du jour", "صندوق اليوم")}
              </Text>
              <Text style={s.metricNumber}>
                {money(cash.expected_centimes)}
              </Text>
              <Text style={s.small}>
                {t("Fond initial", "الرصيد الافتتاحي")}:{" "}
                {money(cash.opening_centimes)} ·{" "}
                {t("Mouvements nets", "صافي الحركات")}:{" "}
                {money(cash.net_centimes)}
              </Text>
              <Text style={s.small}>
                {t("Mouvements nets en espèces", "صافي الحركات النقدية")} ·{" "}
                {cash.day}
              </Text>
              {!cash.closure &&
                !cash.opened &&
                button(
                  t("Fond de caisse initial", "الرصيد الافتتاحي"),
                  () =>
                    form(
                      t("Fond initial", "الرصيد الافتتاحي"),
                      [
                        field(
                          "amount",
                          "Montant initial DA",
                          "الرصيد الافتتاحي دج",
                          "0",
                          { numeric: true },
                        ),
                      ],
                      (v) =>
                        api("cash/open", "POST", {
                          amount_centimes: centimes(v.amount),
                        }),
                    ),
                  true,
                )}
              {cash.closure ? (
                <Text style={s.muted}>
                  {t("Clôturée", "مغلق")} · {t("écart", "الفرق")}{" "}
                  {money(
                    cash.closure.counted_centimes -
                      cash.closure.expected_centimes,
                  )}
                </Text>
              ) : (
                button(
                  t("Clôturer la caisse", "إغلاق الصندوق"),
                  () =>
                    form(
                      t("Clôture du jour", "إغلاق اليوم"),
                      [
                        field(
                          "counted",
                          "Espèces dans le tiroir DA",
                          "النقد الموجود في الصندوق دج",
                          String(cash.expected_centimes / 100),
                          { numeric: true },
                        ),
                        field(
                          "notes",
                          "Notes / écart",
                          "ملاحظات / الفرق",
                          undefined,
                          { optional: true, multiline: true },
                        ),
                      ],
                      (v) =>
                        api("cash/close", "POST", {
                          day: cash.day,
                          counted_centimes: centimes(v.counted),
                          notes: v.notes,
                        }),
                    ),
                  true,
                )
              )}
            </View>
          )}
          {page === "payroll" && (
            <Text style={s.muted}>
              {t("Rémunérations pour", "الأجور لشهر")} {payrollMonth}
            </Text>
          )}
          {page !== "dashboard" &&
            page !== "sessions" &&
            page !== "exports" &&
            page !== "registrations" &&
            page !== "account" &&
            shown.map((r) => (
              <View
                style={[
                  s.card,
                  page === "notifications" && !r.seen && s.unread,
                ]}
                key={r.id}
              >
                {page === "students" && (
                  <>
                    <Text style={[s.cardTitle, rtl]}>{r.name}</Text>
                    <Text style={[s.muted, rtl]}>
                      {r.level || "—"} · {r.phone || "—"}
                    </Text>
                    <Text style={[s.small, rtl]}>
                      {r.parent_name ||
                        t(
                          "Aucun compte parent associé",
                          "لا يوجد حساب ولي مرتبط",
                        )}
                    </Text>
                    {admin &&
                      button(
                        t("Modifier", "تعديل"),
                        () => studentForm(r),
                        true,
                      )}
                  </>
                )}
                {page === "groups" && (
                  <>
                    <Text style={[s.cardTitle, rtl]}>{r.name}</Text>
                    <Text style={[s.muted, rtl]}>
                      {r.subject} · {r.teacher_name || "—"}
                    </Text>
                    <Text style={[s.text, rtl]}>
                      {r.student_count}/{r.capacity} · {r.room} ·{" "}
                      {money(r.fee_centimes)}
                    </Text>
                    {button(
                      t("Voir les inscrits", "عرض المسجلين"),
                      () => void roster(r),
                      true,
                    )}
                    {admin &&
                      button(t("Modifier", "تعديل"), () => groupForm(r), true)}
                    {admin &&
                      button(
                        t("Supprimer le cours", "حذف الدرس"),
                        () => removeRecord("groups", r),
                        true,
                      )}
                  </>
                )}
                {page === "sessions" && (
                  <>
                    <View style={s.cardTop}>
                      <Text style={[s.cardTitle, rtl, { flex: 1 }]}>
                        {r.group_name}
                      </Text>
                      <Text style={s.pill}>{tr(r.status)}</Text>
                    </View>
                    <Text style={[s.text, rtl]}>{date(r.starts_at)}</Text>
                    <Text style={[s.small, rtl]}>
                      {t("Fin", "النهاية")} : {date(r.ends_at)} · {r.room}
                    </Text>
                    {button(
                      t("Présences", "الحضور"),
                      () => void attendance(r),
                      true,
                    )}
                    {teach && (
                      <>
                        {button(
                          t("Reprogrammer", "إعادة جدولة"),
                          () => sessionForm(r),
                          true,
                        )}
                        {button(
                          t("Changer le statut", "تغيير الحالة"),
                          () =>
                            form(
                              t("Statut de la séance", "حالة الحصة"),
                              [
                                field("status", "Statut", "الحالة", r.status, {
                                  options: [
                                    "scheduled",
                                    "completed",
                                    "cancelled",
                                  ].map((value) => ({
                                    value,
                                    label: tr(value),
                                  })),
                                }),
                              ],
                              (v) => api(`sessions/${r.id}/status`, "POST", v),
                            ),
                          true,
                        )}
                      </>
                    )}
                  </>
                )}
                {page === "delivery" && (
                  <>
                    <Text style={s.cardTitle}>
                      {r.recipient_name} · {r.channel}
                    </Text>
                    <Text>{r.recipient_email}</Text>
                    <Text>
                      {r.state === "sent"
                        ? r.channel === "email"
                          ? "SMTP accepté — réception non confirmée"
                          : "Push accepté"
                        : r.state}{" "}
                      · {r.topic}
                    </Text>
                    <Text>
                      {r.error_code} · {r.last_error}
                    </Text>
                  </>
                )}
                {page === "invoices" && (
                  <>
                    <Text style={[s.cardTitle, rtl]}>{r.student_name}</Text>
                    <Text style={[s.muted, rtl]}>{r.label}</Text>
                    <Text style={[s.metricNumber, rtl]}>
                      {money(r.balance_centimes)}
                    </Text>
                    <Text style={[s.small, rtl]}>
                      {t("Montant", "المبلغ")} {money(r.amount_centimes)} ·{" "}
                      {t("Payé", "المدفوع")} {money(r.paid_centimes)}
                    </Text>
                    <Text style={[s.small, rtl]}>
                      {t("Date limite", "الاستحقاق")} {r.due_date} ·{" "}
                      {r.status === "cancelled"
                        ? tr("cancelled")
                        : t("Ouverte", "مفتوح")}
                    </Text>
                    {button(
                      t("Imprimer / enregistrer PDF", "طباعة / حفظ PDF"),
                      () => void action(() => invoicePdf(r)),
                      true,
                    )}
                    {finance &&
                      r.status === "open" &&
                      button(
                        t(
                          "Envoyer au parent / élève",
                          "إرسال إلى الولي / التلميذ",
                        ),
                        () =>
                          void action(async () => {
                            const result = await api(
                              `invoices/${r.id}/send`,
                              "POST",
                              {},
                            );
                            if (!result.emails)
                              throw new Error(
                                t(
                                  "Aucun email vérifié ; les notifications ont été ajoutées.",
                                  "لا يوجد بريد مؤكد؛ أضيفت الإشعارات.",
                                ),
                              );
                          }),
                        true,
                      )}
                    {finance &&
                      r.status === "open" &&
                      r.balance_centimes > 0 &&
                      button(t("Encaisser", "تحصيل"), () => paymentForm(r))}
                  </>
                )}
                {page === "payments" && (
                  <>
                    <View style={s.cardTop}>
                      <Text style={s.cardTitle}>
                        #{r.receipt_number} · {r.student_name}
                      </Text>
                      <Text style={s.pill}>{tr(r.kind)}</Text>
                    </View>
                    <Text style={s.metricNumber}>
                      {r.kind === "refund" ? "−" : ""}
                      {money(r.amount_centimes)}
                    </Text>
                    <Text style={[s.muted, rtl]}>{r.invoice_label}</Text>
                    <Text style={[s.small, rtl]}>
                      {date(r.created_at)} · {tr(r.method)} · {r.reference}
                    </Text>
                    {button(
                      t("Partager le reçu", "مشاركة الإيصال"),
                      () =>
                        void Share.share({
                          message: `${user.school} — EduBest\n${t("Reçu", "إيصال")} #${r.receipt_number}\n${r.student_name} · ${r.invoice_label}\n${tr(r.kind)} : ${money(r.amount_centimes)}\n${date(r.created_at)} · ${tr(r.method)}\n${r.reference}\n${t("Reçu de versement, sans valeur de facture fiscale.", "إيصال دفع، ليس فاتورة ضريبية.")}`,
                        }),
                      true,
                    )}
                    {finance &&
                      r.kind === "payment" &&
                      button(
                        t("Rembourser", "استرداد"),
                        () => refundForm(r),
                        true,
                      )}
                  </>
                )}
                {page === "payroll" && (
                  <>
                    <Text style={s.cardTitle}>{r.name}</Text>
                    <Text style={s.metricNumber}>
                      {money(r.balance_centimes)}
                    </Text>
                    <Text style={s.muted}>
                      {t("Calculé", "المحسوب")} {money(r.earned_centimes)} ·{" "}
                      {t("Réglé", "المسدد")} {money(r.paid_centimes)}
                    </Text>
                    {r.groups.map((g: Row) => (
                      <Text style={s.small} key={g.id}>
                        {g.name} · {g.session_count} {t("séances", "حصص")} ·{" "}
                        {g.hours.toFixed(1)} h
                      </Text>
                    ))}
                    {finance &&
                      r.balance_centimes > 0 &&
                      button(
                        t("Régler", "تسديد"),
                        () =>
                          form(
                            t("Régler la rémunération", "تسديد الأجر"),
                            [
                              field(
                                "amount",
                                "Montant DA",
                                "المبلغ دج",
                                String(r.balance_centimes / 100),
                                { numeric: true },
                              ),
                              field("reference", "Référence", "المرجع"),
                            ],
                            (v) =>
                              api("payroll", "POST", {
                                teacher_id: r.id,
                                month: payrollMonth,
                                amount_centimes: centimes(v.amount),
                                reference: v.reference,
                              }),
                          ),
                        true,
                      )}
                  </>
                )}
                {["announcements", "notifications"].includes(page) && (
                  <>
                    <Text style={s.small}>
                      {r.group_name || user.school} · {date(r.created_at)}
                    </Text>
                    <Text style={[s.cardTitle, rtl, { marginTop: 10 }]}>
                      {r.title}
                    </Text>
                    <Text style={[s.text, rtl]}>{r.body}</Text>
                    {page === "notifications" &&
                      !r.seen &&
                      button(
                        t("Marquer comme lu", "تحديد كمقروء"),
                        () =>
                          void action(() =>
                            api("notifications/read", "POST", { id: r.id }),
                          ),
                        true,
                      )}
                  </>
                )}
                {page === "materials" && (
                  <>
                    <Text style={[s.cardTitle, rtl]}>{r.title}</Text>
                    <Text style={[s.muted, rtl]}>
                      {r.group_name} · {r.filename}
                    </Text>
                    {button(
                      t("Télécharger / partager", "تحميل / مشاركة"),
                      () => void download(r),
                      true,
                    )}
                  </>
                )}
                {page === "users" && (
                  <>
                    <Text style={s.cardTitle}>{r.name}</Text>
                    <Text style={s.muted}>{r.email}</Text>
                    <Text style={s.pill}>
                      {r.role} ·{" "}
                      {r.active
                        ? r.verified
                          ? t("Actif", "نشط")
                          : t("Invitation en attente", "دعوة معلقة")
                        : r.role === "TEACHER"
                          ? t(
                              "Retiré — historique conservé",
                              "مسحوب — السجل محفوظ",
                            )
                          : t("Désactivé", "معطل")}
                    </Text>
                    {canRemoveTeacher(user.role, r) &&
                      button(
                        t("Supprimer cet enseignant", "حذف هذا الأستاذ"),
                        () => removeRecord("users", r),
                        true,
                      )}
                    {user.role === "OWNER" &&
                      r.id !== user.id &&
                      r.role !== "OWNER" &&
                      button(
                        r.active
                          ? t("Désactiver", "تعطيل")
                          : t("Réactiver", "تفعيل"),
                        () =>
                          void action(() =>
                            api(`users/${r.id}`, "PATCH", {
                              active: !r.active,
                            }),
                          ),
                        true,
                      )}
                  </>
                )}
                {page === "audit" && (
                  <>
                    <Text style={s.small}>
                      {date(r.created_at)} · {r.actor}
                    </Text>
                    <Text style={s.strong}>{r.action}</Text>
                    <Text style={s.small}>{JSON.stringify(r.detail)}</Text>
                  </>
                )}
              </View>
            ))}
          {!loading &&
            ![
              "account",
              "dashboard",
              "exports",
              "delivery",
              "sessions",
              "registrations",
            ].includes(page) &&
            !shown.length && (
              <View style={s.emptyCard}>
                <Text style={[s.cardTitle, rtl]}>
                  {t("Aucune entrée pour le moment", "لا توجد سجلات حاليًا")}
                </Text>
                <Text style={[s.muted, rtl]}>
                  {t(
                    "Vos informations apparaîtront ici.",
                    "ستظهر معلوماتك هنا.",
                  )}
                </Text>
              </View>
            )}
          {page === "account" && (
            <>
              <MobileSecurity ar={ar} onStatus={setActivationRequired} />
              <View style={s.card}>
                <Text style={s.cardTitle}>{user.name}</Text>
                <Text style={s.muted}>{user.email}</Text>
                {!!user.phone && <Text style={s.muted}>{user.phone}</Text>}
                <Text style={s.small}>
                  {user.school} ·{" "}
                  {t(
                    {
                      OWNER: "Administrateur principal",
                      MANAGER: "Administrateur",
                      CASHIER: "Caissier",
                      SECRETARY: "Secrétaire",
                      TEACHER: "Enseignant",
                      PARENT: "Parent",
                      STUDENT: "Élève",
                    }[user.role],
                    {
                      OWNER: "المدير الرئيسي",
                      MANAGER: "المدير",
                      CASHIER: "أمين الصندوق",
                      SECRETARY: "أمين التسجيل",
                      TEACHER: "أستاذ",
                      PARENT: "ولي",
                      STUDENT: "تلميذ",
                    }[user.role],
                  )}
                </Text>
              </View>
              {user.role !== "SECRETARY" &&
                button(
                  t("Activer les notifications", "تفعيل الإشعارات"),
                  () => void pushes(),
                  true,
                )}
              {button(
                t("Changer mon mot de passe", "تغيير كلمة المرور"),
                () =>
                  form(
                    t("Mot de passe", "كلمة المرور"),
                    [
                      field(
                        "current",
                        "Mot de passe actuel",
                        "كلمة المرور الحالية",
                        undefined,
                        { secure: true },
                      ),
                      field(
                        "password",
                        "Nouveau mot de passe (8 caractères minimum)",
                        "كلمة المرور الجديدة (8 أحرف على الأقل)",
                        undefined,
                        { secure: true, newPassword: true },
                      ),
                      ...(admin
                        ? [
                            field(
                              "code",
                              "Code de double authentification (si activée)",
                              "رمز المصادقة الثنائية (عند التفعيل)",
                              undefined,
                              { optional: true },
                            ),
                          ]
                        : []),
                    ],
                    (v) => api("auth/password", "POST", v),
                  ),
                true,
              )}
              {button(
                t("Ouvrir la gestion web", "فتح إدارة الويب"),
                () => void Linking.openURL(`${WEBSITE}/app`),
                true,
              )}
              {button(
                t("Confidentialité & conditions", "الخصوصية والشروط"),
                () => void Linking.openURL(`${WEBSITE}/legal`),
                true,
              )}
              {user.role !== "OWNER" &&
                button(
                  t("Supprimer mon compte", "حذف حسابي"),
                  () =>
                    form(
                      t("Suppression du compte personnel", "حذف الحساب الشخصي"),
                      [
                        field(
                          "password",
                          "Mot de passe. Les écritures financières sont conservées.",
                          "كلمة المرور. السجلات المالية محفوظة.",
                          undefined,
                          { secure: true },
                        ),
                        ...(admin
                          ? [
                              field(
                                "code",
                                "Code de double authentification (si activée)",
                                "رمز المصادقة الثنائية (عند التفعيل)",
                                undefined,
                                { optional: true },
                              ),
                            ]
                          : []),
                        field(
                          "confirm",
                          "Saisissez SUPPRIMER",
                          "اكتب SUPPRIMER",
                        ),
                      ],
                      async (v) => {
                        if (v.confirm !== "SUPPRIMER")
                          throw new Error(
                            t("Confirmation incorrecte", "تأكيد غير صحيح"),
                          );
                        await api("auth/delete-account", "POST", {
                          password: v.password,
                          code: v.code || undefined,
                        });
                        await setSession("");
                        setUser(null);
                      },
                    ),
                  true,
                )}
              {button(t("Se déconnecter", "تسجيل الخروج"), () => void logout())}
            </>
          )}
          <Brand
            width={110}
            style={{ alignSelf: "center", marginVertical: 25 }}
          />
        </ScrollView>
        {!wide && (
          <View style={s.bottom}>
            {(user.role === "SECRETARY"
              ? [
                  ["registrations", "▦", t("Inscriptions", "التسجيلات")],
                  ["account", "○", t("Compte", "الحساب")],
                ]
              : [
                  ["dashboard", "⌂", t("Accueil", "الرئيسية")],
                  ["sessions", "▦", t("Planning", "الجدول")],
                  [
                    "notifications",
                    "♧",
                    t("Messages", "الرسائل") + (unread ? ` (${unread})` : ""),
                  ],
                  ["account", "○", t("Compte", "الحساب")],
                ]
            ).map(([p, icon, label]) => (
              <Pressable
                style={s.tab}
                accessibilityRole="button"
                accessibilityState={{ selected: page === p }}
                key={p}
                onPress={() => nav(p)}
              >
                <Text style={[s.tabIcon, page === p && s.tabActive]}>
                  {icon}
                </Text>
                <Text style={[s.tabText, page === p && s.tabActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <Modal
        visible={menu}
        animationType="slide"
        onRequestClose={() => setMenu(false)}
      >
        <SafeAreaView style={s.safe}>
          <View style={s.modalTop}>
            <Text style={s.title}>{t("Votre espace", "مساحتك")}</Text>
            {button("×", () => setMenu(false), true)}
          </View>
          <ScrollView contentContainerStyle={s.content}>
            {menus.map((p) => (
              <Pressable style={s.menuRow} key={p} onPress={() => nav(p)}>
                <Text style={[s.strong, rtl]}>
                  {pageLabel(p, user.role, ar ? "ar" : "fr")}
                </Text>
                <Text>›</Text>
              </Pressable>
            ))}
            <Pressable style={s.menuRow} onPress={() => nav("account")}>
              <Text style={s.strong}>{t("Mon profil", "ملفي الشخصي")}</Text>
              <Text>›</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {detail && (
        <Modal animationType="slide" onRequestClose={() => setDetail(null)}>
          <SafeAreaView style={s.safe}>
            <View style={s.modalTop}>
              <Text style={[s.cardTitle, { flex: 1 }]}>
                {detail.row.group_name || detail.row.name}
              </Text>
              {button("×", () => setDetail(null), true)}
            </View>
            <ScrollView contentContainerStyle={s.content}>
              {detail.kind === "session" && (
                <View style={s.card}>
                  <Text style={s.cardTitle}>
                    {detail.row.subject || detail.row.group_name}
                  </Text>
                  <Text>{detail.row.group_name}</Text>
                  <Text>
                    {date(detail.row.starts_at)} — {date(detail.row.ends_at)}
                  </Text>
                  <Text>
                    {detail.row.status === "cancelled"
                      ? t("Cours annulé", "حصة ملغاة")
                      : detail.row.status === "completed"
                        ? t("Séance terminée", "الحصة منتهية")
                        : t("Séance programmée", "الحصة مبرمجة")}
                  </Text>
                  <Text>
                    {t("Salle", "القاعة")} :{" "}
                    {detail.row.room || t("À confirmer", "قيد التأكيد")}
                  </Text>
                  <Text>
                    {t("Enseignant", "الأستاذ")} :{" "}
                    {detail.row.teacher_name || t("À confirmer", "قيد التأكيد")}
                  </Text>
                  {detail.row.children?.length > 0 && (
                    <Text>
                      {detail.row.children.map((c: Row) => c.name).join(" · ")}
                    </Text>
                  )}
                  {!!detail.row.notes && <Text>{detail.row.notes}</Text>}
                  {canRemoveSession(user.role, detail.row) &&
                    button(
                      t("Supprimer cette séance", "حذف هذه الحصة"),
                      () => removeRecord("sessions", detail.row),
                      true,
                    )}
                  {teach &&
                    detail.row.status !== "cancelled" &&
                    Date.parse(detail.row.starts_at) <= Date.now() &&
                    button(
                      t("Faire l’appel", "تسجيل الحضور"),
                      () => void attendance(detail.row),
                    )}
                  {button(
                    t("Documents de cours", "وثائق الدروس"),
                    () => nav("materials"),
                    true,
                  )}
                </View>
              )}
              {detail.kind === "notice" && (
                <View style={s.card}>
                  <Text style={s.cardTitle}>{detail.row.title}</Text>
                  <Text style={s.muted}>{date(detail.row.created_at)}</Text>
                  <Text>{detail.row.body}</Text>
                  {detail.row.notice &&
                    button(
                      t("Marquer comme lu", "تحديد كمقروء"),
                      () =>
                        void action(async () => {
                          await api("notifications/read", "POST", {
                            id: detail.row.id,
                          });
                          setDetail(null);
                        }),
                    )}
                </View>
              )}
              {detail.kind === "attendance" && (
                <>
                  <Text style={s.muted}>{date(detail.row.starts_at)}</Text>
                  {detail.rows.map((r, i) => (
                    <View key={r.student_id} style={s.card}>
                      <Text style={s.cardTitle}>{r.name}</Text>
                      <View style={s.chips}>
                        {["unmarked", "present", "absent", "late"].map((st) => (
                          <Pressable
                            disabled={
                              !teach || detail.row.status === "cancelled"
                            }
                            key={st}
                            style={[s.chip, r.status === st && s.selected]}
                            onPress={() =>
                              setDetail({
                                ...detail,
                                rows: detail.rows.map((x, j) =>
                                  i === j ? { ...x, status: st } : x,
                                ),
                              })
                            }
                          >
                            <Text
                              style={[
                                s.chipText,
                                r.status === st && s.selectedText,
                              ]}
                            >
                              {tr(st)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      {r.justification && (
                        <>
                          <Text style={s.muted}>{r.justification}</Text>
                          <Text style={s.small}>{tr(r.decision)}</Text>
                          {teach && r.decision === "pending" && (
                            <View style={s.inline}>
                              {["accepted", "rejected"].map((d) => (
                                <Pressable
                                  key={d}
                                  onPress={() =>
                                    void action(async () => {
                                      await api(
                                        `sessions/${detail.row.id}/decision`,
                                        "POST",
                                        {
                                          student_id: r.student_id,
                                          decision: d,
                                        },
                                      );
                                      await attendance(detail.row);
                                    })
                                  }
                                >
                                  <Text style={s.link}>{tr(d)}</Text>
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </>
                      )}
                      {family &&
                        ["absent", "late"].includes(r.status) &&
                        button(
                          t("Justifier", "تبرير"),
                          () =>
                            form(
                              t("Justificatif", "تبرير"),
                              [
                                field(
                                  "justification",
                                  "Votre message",
                                  "رسالتك",
                                  r.justification,
                                  { multiline: true },
                                ),
                              ],
                              async (v) => {
                                await api(
                                  `sessions/${detail.row.id}/justify`,
                                  "POST",
                                  {
                                    student_id: r.student_id,
                                    justification: v.justification,
                                  },
                                );
                                await attendance(detail.row);
                              },
                            ),
                          true,
                        )}
                    </View>
                  ))}
                  {teach &&
                    detail.row.status === "scheduled" &&
                    Date.parse(detail.row.ends_at) <= Date.now() &&
                    detail.rows.length > 0 &&
                    button(
                      t(
                        "Enregistrer l’appel et terminer la séance",
                        "حفظ النداء وإنهاء الحصة",
                      ),
                      () =>
                        void action(async () => {
                          await api(
                            `sessions/${detail.row.id}/attendance`,
                            "PUT",
                            {
                              entries: detail.rows.map((r) => ({
                                student_id: r.student_id,
                                status: r.status,
                              })),
                            },
                          );
                          await api(
                            `sessions/${detail.row.id}/status`,
                            "POST",
                            { status: "completed" },
                          );
                          setDetail(null);
                        }),
                    )}
                  {teach && (
                    <Text style={s.small}>
                      {t(
                        "La rémunération par séance ou heure est calculée seulement lorsque la séance est terminée. Le pourcentage suit les encaissements nets.",
                        "أجر الحصة أو الساعة يُحسب عند إنهاء الحصة. النسبة تتبع صافي التحصيل.",
                      )}
                    </Text>
                  )}
                  {teach &&
                    detail.rows.length > 0 &&
                    detail.row.status !== "cancelled" &&
                    button(
                      t("Enregistrer les présences", "حفظ الحضور"),
                      () =>
                        void action(() =>
                          api(`sessions/${detail.row.id}/attendance`, "PUT", {
                            entries: detail.rows.map((r) => ({
                              student_id: r.student_id,
                              status: r.status,
                            })),
                          }),
                        ),
                    )}
                </>
              )}
              {detail.kind === "roster" && (
                <>
                  {detail.rows.map((r) => (
                    <View style={s.card} key={r.id}>
                      <Text style={s.cardTitle}>{r.name}</Text>
                      <Text style={s.small}>{r.level}</Text>
                      {admin &&
                        button(
                          t("Retirer du groupe", "إزالة من المجموعة"),
                          () =>
                            void action(async () => {
                              await api(
                                `groups/${detail.row.id}/enroll/${r.id}`,
                                "DELETE",
                              );
                              await roster(detail.row);
                            }),
                          true,
                        )}
                    </View>
                  ))}
                  {admin &&
                    button(t("+ Inscrire un élève", "+ تسجيل تلميذ"), () =>
                      form(
                        t("Inscrire au groupe", "التسجيل في المجموعة"),
                        [
                          choose(
                            "student_id",
                            "Élève",
                            "التلميذ",
                            lookup.students.filter(
                              (r) => !detail.rows.some((x) => x.id === r.id),
                            ),
                          ),
                        ],
                        async (v) => {
                          await api(
                            `groups/${detail.row.id}/enroll`,
                            "POST",
                            v,
                          );
                          await roster(detail.row);
                        },
                      ),
                    )}
                </>
              )}
              {error && <Text style={s.error}>{error}</Text>}
              {message && <Text style={s.success}>{message}</Text>}
            </ScrollView>
            {editor && (
              <EditorModal
                editor={editor}
                ar={ar}
                close={() => setEditor(null)}
                save={async (v) => {
                  await editor.save(v);
                  setEditor(null);
                  await load();
                }}
              />
            )}
          </SafeAreaView>
        </Modal>
      )}
      {editor && !detail && (
        <EditorModal
          editor={editor}
          ar={ar}
          close={() => setEditor(null)}
          save={async (v) => {
            await editor.save(v);
            setEditor(null);
            setMessage(t("Enregistré", "تم الحفظ"));
            await load();
          }}
        />
      )}
    </SafeAreaView>
  );
}
function Login({
  ar,
  busy,
  submit,
  mfaRequired,
}: {
  ar: boolean;
  busy: boolean;
  submit: (v: Record<string, string>) => void;
  mfaRequired: boolean;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState("");
  return (
    <View style={{ marginTop: 28 }}>
      {[
        [ar ? "البريد الإلكتروني" : "Email", email, setEmail, false],
        [ar ? "كلمة المرور" : "Mot de passe", password, setPassword, true],
        [
          ar
            ? "رمز المصادقة الثنائية (للمدير فقط)"
            : "Code de double authentification (administrateurs uniquement)",
          code,
          setCode,
          false,
        ],
      ]
        .filter((_, i) => i < 2 || mfaRequired)
        .map(([label, value, change, secure]) => (
          <View key={label as string}>
            <Text style={s.label}>{label as string}</Text>
            <TextInput
              accessibilityLabel={label as string}
              style={s.input}
              value={value as string}
              onChangeText={change as (v: string) => void}
              secureTextEntry={secure as boolean}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={
                secure
                  ? "password"
                  : label === "Email"
                    ? "emailAddress"
                    : "none"
              }
            />
          </View>
        ))}
      <Pressable
        disabled={busy || !email || !password}
        style={[s.button, busy && s.disabled]}
        onPress={() => submit({ email, password, ...(code ? { code } : {}) })}
      >
        <Text style={s.buttonText}>
          {busy ? (ar ? "لحظة…" : "Un instant…") : ar ? "دخول" : "Se connecter"}
        </Text>
      </Pressable>
    </View>
  );
}
function EditorModal({
  editor,
  ar,
  close,
  save,
}: {
  editor: Editor;
  ar: boolean;
  close: () => void;
  save: (v: Record<string, string>) => Promise<void>;
}) {
  const [v, setV] = useState<Record<string, string>>(
      Object.fromEntries(editor.fields.map((f) => [f.key, f.value ?? ""])),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      for (const f of editor.fields.filter(
        (f) => !f.visibleWhen || v[f.visibleWhen.key] === f.visibleWhen.value,
      )) {
        if (!f.optional && !v[f.key]?.trim())
          throw new Error(`${f.label}: ${ar ? "مطلوب" : "requis"}`);
        if (f.exactValue && v[f.key]?.trim() !== f.exactValue)
          throw new Error(
            ar
              ? "اكتب SUPPRIMER للتأكيد."
              : "Saisissez SUPPRIMER pour confirmer.",
          );
        if (f.newPassword && !password.safeParse(v[f.key]).success)
          throw new Error(passwordGuidance[ar ? "ar" : "fr"]);
      }
      await save(v);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.backdrop}
      >
        <View style={s.sheet}>
          <View style={s.modalTop}>
            <Text style={[s.cardTitle, { flex: 1 }]}>{editor.title}</Text>
            <Pressable
              accessibilityLabel="Fermer / إغلاق"
              disabled={busy}
              onPress={close}
            >
              <Text style={s.menuIcon}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 22 }}
            keyboardShouldPersistTaps="handled"
          >
            {!!editor.description && (
              <Text style={s.muted}>{editor.description}</Text>
            )}
            {editor.fields
              .filter(
                (f) =>
                  !f.visibleWhen ||
                  v[f.visibleWhen.key] === f.visibleWhen.value,
              )
              .map((f) => (
                <View key={f.key}>
                  <Text style={[s.label, ar && { textAlign: "right" }]}>
                    {f.key === "pay_value"
                      ? v.pay_mode === "percent"
                        ? ar
                          ? "حصة الأستاذ (%) من 0 إلى 100"
                          : "Part enseignant (%) — 0 à 100"
                        : v.pay_mode === "hour"
                          ? ar
                            ? "الأجر (دج / ساعة)"
                            : "Rémunération (DA / heure)"
                          : ar
                            ? "الأجر (دج / حصة)"
                            : "Rémunération (DA / séance)"
                      : f.label}
                  </Text>
                  {f.options ? (
                    <View style={s.chips}>
                      {f.optional && (
                        <Pressable
                          style={[s.chip, !v[f.key] && s.selected]}
                          onPress={() => setV({ ...v, [f.key]: "" })}
                        >
                          <Text
                            style={[s.chipText, !v[f.key] && s.selectedText]}
                          >
                            —
                          </Text>
                        </Pressable>
                      )}
                      {f.options.map((o) => (
                        <Pressable
                          key={o.value}
                          style={[s.chip, v[f.key] === o.value && s.selected]}
                          onPress={() => setV({ ...v, [f.key]: o.value })}
                        >
                          <Text
                            style={[
                              s.chipText,
                              v[f.key] === o.value && s.selectedText,
                            ]}
                          >
                            {o.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <TextInput
                      accessibilityLabel={f.label}
                      value={v[f.key]}
                      onChangeText={(x) => setV({ ...v, [f.key]: x })}
                      style={[
                        s.input,
                        f.multiline && {
                          minHeight: 110,
                          textAlignVertical: "top",
                        },
                      ]}
                      secureTextEntry={f.secure}
                      maxLength={
                        f.newPassword ? PASSWORD_MAX_LENGTH : undefined
                      }
                      textContentType={
                        f.newPassword ? "newPassword" : undefined
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                      multiline={f.multiline}
                      keyboardType={f.numeric ? "decimal-pad" : "default"}
                    />
                  )}
                  {f.newPassword && (
                    <Text style={s.small}>
                      {passwordGuidance[ar ? "ar" : "fr"]}
                    </Text>
                  )}
                </View>
              ))}
            {error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            <Pressable
              style={[s.button, busy && s.disabled]}
              disabled={busy}
              onPress={() => void submit()}
            >
              <Text style={s.buttonText}>
                {busy
                  ? ar
                    ? "جاري الحفظ…"
                    : "Enregistrement…"
                  : ar
                    ? "تأكيد"
                    : "Confirmer"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.paper },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
  login: {
    padding: 28,
    paddingTop: 20,
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
  },
  mark: {
    backgroundColor: theme.action,
    color: theme.sidebarText,
    height: 60,
    width: 60,
    borderRadius: 16,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 40,
    overflow: "hidden",
    marginTop: 20,
    lineHeight: 55,
  },
  brand: {
    fontSize: 19,
    fontWeight: "700",
    color: theme.ink,
    marginTop: 18,
    marginBottom: 20,
  },
  hero: {
    fontSize: 34,
    fontWeight: "600",
    color: theme.ink,
    lineHeight: 42,
    marginBottom: 15,
  },
  muted: { fontSize: 13, lineHeight: 22, color: theme.muted, marginBottom: 12 },
  text: { fontSize: 14, lineHeight: 23, color: theme.muted, marginBottom: 10 },
  small: { fontSize: 10, lineHeight: 18, color: theme.muted },
  label: {
    fontSize: 12,
    fontWeight: "500",
    color: theme.muted,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 9,
    backgroundColor: theme.surface,
    padding: 13,
    color: theme.ink,
    fontSize: 14,
    marginBottom: 19,
    minHeight: 48,
  },
  button: {
    backgroundColor: theme.action,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 9,
    alignItems: "center",
    marginBottom: 12,
    minHeight: 45,
    justifyContent: "center",
  },
  buttonText: { color: theme.surface, fontSize: 13, fontWeight: "600" },
  secondary: {
    backgroundColor: theme.paper,
    borderWidth: 1,
    borderColor: theme.line,
  },
  secondaryText: { color: theme.muted },
  disabled: { opacity: 0.5 },
  link: { fontSize: 13, color: theme.action, fontWeight: "500" },
  error: {
    backgroundColor: theme.dangerBg,
    color: theme.danger,
    padding: 14,
    borderRadius: 8,
    marginVertical: 10,
    fontSize: 12,
    lineHeight: 20,
  },
  success: {
    backgroundColor: theme.successBg,
    color: theme.success,
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
    fontSize: 12,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 13,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  topBrand: { fontSize: 21, fontWeight: "700", color: theme.ink },
  topArabic: { fontSize: 13, fontWeight: "400", color: theme.muted },
  menuIcon: { fontSize: 24, color: theme.muted },
  inline: { flexDirection: "row", gap: 20, alignItems: "center" },
  content: {
    padding: 22,
    paddingBottom: 30,
    maxWidth: 850,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: theme.ink,
    marginTop: 10,
    marginBottom: 26,
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  metric: {
    width: "47.5%",
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 17,
    borderRadius: 12,
    minHeight: 105,
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.muted,
    marginVertical: 8,
  },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 11,
    padding: 19,
    marginBottom: 16,
  },
  featureCard: {
    backgroundColor: theme.soft,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.muted,
    marginBottom: 10,
  },
  strong: { fontSize: 13, fontWeight: "600", color: theme.muted },
  agenda: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: theme.line,
  },
  agendaDay: {
    backgroundColor: theme.softBlue,
    color: theme.action,
    fontSize: 22,
    fontWeight: "600",
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 9,
    overflow: "hidden",
  },
  empty: {
    color: theme.muted,
    textAlign: "center",
    fontSize: 12,
    paddingVertical: 25,
  },
  emptyCard: {
    padding: 35,
    backgroundColor: theme.surface,
    borderRadius: 12,
    alignItems: "center",
  },
  foot: {
    textAlign: "center",
    fontSize: 10,
    color: theme.muted,
    marginTop: 25,
  },
  cardTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  pill: {
    backgroundColor: theme.paper,
    color: theme.action,
    borderRadius: 5,
    padding: 6,
    overflow: "hidden",
    fontSize: 10,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  warning: {
    padding: 16,
    backgroundColor: "#fcf2d8",
    borderRadius: 10,
    marginBottom: 20,
  },
  unread: { borderColor: theme.lineStrong, backgroundColor: theme.paper },
  bottom: {
    flexDirection: "row",
    paddingTop: 9,
    paddingBottom: 7,
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: theme.surface,
  },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  tabIcon: { fontSize: 24, color: theme.muted },
  tabText: { fontSize: 9, color: theme.muted },
  tabActive: { color: theme.action, fontWeight: "700" },
  modalTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 22,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    gap: 18,
  },
  menuRow: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  chip: {
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
    backgroundColor: theme.paper,
  },
  chipText: { fontSize: 11, color: theme.muted },
  selected: { backgroundColor: theme.action, borderColor: theme.action },
  selectedText: { color: theme.surface },
  backdrop: {
    flex: 1,
    backgroundColor: theme.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    minHeight: "40%",
  },
});

const r = StyleSheet.create({
  sidebar: {
    width: 248,
    backgroundColor: theme.navy,
    paddingHorizontal: 17,
    paddingTop: 25,
    paddingBottom: 20,
  },
  sideBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 27,
    paddingHorizontal: 10,
  },
  sideMark: {
    width: 38,
    height: 38,
    lineHeight: 37,
    textAlign: "center",
    backgroundColor: theme.navyRaised,
    color: theme.surface,
    fontSize: 25,
    borderRadius: 10,
    overflow: "hidden",
  },
  sideBrandText: { color: theme.surface, fontSize: 25, fontWeight: "700" },
  sideArabic: { fontSize: 12, color: theme.sidebarMuted, fontWeight: "400" },
  sideSchool: {
    fontSize: 12,
    color: theme.pale,
    lineHeight: 20,
    paddingHorizontal: 11,
    marginBottom: 25,
  },
  sideCaption: {
    fontSize: 9,
    color: theme.sidebarMuted,
    letterSpacing: 1,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  sideItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 2,
  },
  sideActive: { backgroundColor: theme.action },
  sideItemIcon: {
    fontSize: 18,
    color: theme.sidebarMuted,
    width: 19,
    textAlign: "center",
  },
  sideItemText: { fontSize: 12, color: theme.sidebarText },
  sideActiveText: { color: theme.surface },
  sideProfile: {
    paddingTop: 19,
    borderTopWidth: 1,
    borderColor: theme.onDarkBorder,
    marginTop: 15,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  sideAvatar: {
    width: 33,
    height: 33,
    lineHeight: 32,
    textAlign: "center",
    fontSize: 14,
    color: theme.pale,
    backgroundColor: theme.ink,
    borderRadius: 17,
    overflow: "hidden",
  },
  sideName: { fontSize: 11, color: theme.pale },
  sideRole: { fontSize: 10, color: theme.sidebarMuted, marginTop: 3 },
  sideChevron: { marginLeft: "auto", color: theme.sidebarMuted, fontSize: 19 },
  headerAvatar: {
    height: 31,
    width: 31,
    lineHeight: 30,
    textAlign: "center",
    color: theme.action,
    backgroundColor: theme.soft,
    borderRadius: 17,
    overflow: "hidden",
    fontSize: 13,
  },
});
