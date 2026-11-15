import React, { useEffect, useState } from "react";
import { View, Text, AppState, Alert } from "react-native";
import { api } from "./api";
import { Panel, Button, Input, ui } from "./NativeUi";
type Row = Record<string, any>;
export default function MobileSecurity({
  ar,
  onStatus,
}: {
  ar: boolean;
  onStatus: (required: boolean) => void;
}) {
  const t = (f: string, a: string) => (ar ? a : f);
  const [data, setData] = useState<Row | null>(null),
    [current, setCurrent] = useState(""),
    [code, setCode] = useState(""),
    [secret, setSecret] = useState(""),
    [recovery, setRecovery] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [active, setActive] = useState(
      AppState.currentState === "active" || AppState.currentState === null,
    );
  async function refresh() {
    const d = await api("security/account");
    setData(d);
    onStatus(!!d.mfa_required && !d.mfa_enabled);
  }
  useEffect(() => {
    let live = true;
    api("security/account")
      .then((d) => {
        if (live) {
          setData(d);
          onStatus(!!d.mfa_required && !d.mfa_enabled);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    const listener = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state !== "active") {
        setCurrent("");
        setCode("");
      }
    });
    return () => {
      live = false;
      listener.remove();
    };
  }, []);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setCurrent("");
      setCode("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const proof = () => ({ current, code: code || undefined });
  const when = (v: string) =>
    new Date(v).toLocaleString(ar ? "ar-DZ" : "fr-DZ", {
      timeZone: "Africa/Algiers",
    });
  if (!active)
    return (
      <Panel>
        <Text style={ui.text}>
          {t(
            "Revenez dans EduBest pour afficher la sécurité.",
            "عُد إلى EduBest لعرض الأمان.",
          )}
        </Text>
      </Panel>
    );
  return (
    <View style={{ gap: 16, direction: ar ? "rtl" : "ltr" }}>
      {!!error && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
      {!!message && <Text style={ui.success}>{message}</Text>}
      <Panel title={t("Sécurité de mon compte", "أمان حسابي")}>
        <Text style={ui.text}>
          {data?.mfa_allowed
            ? data.mfa_enabled
              ? t("Double authentification active.", "المصادقة الثنائية مفعلة.")
              : t(
                  "Activez la double authentification pour gérer l’établissement.",
                  "فعّل المصادقة الثنائية لإدارة المؤسسة.",
                )
            : t(
                "Votre rôle utilise le mot de passe ; la double authentification est réservée aux administrateurs.",
                "دورك يستخدم كلمة المرور؛ المصادقة الثنائية مخصصة للمديرين.",
              )}
        </Text>
        <Input
          label={t("Mot de passe actuel", "كلمة المرور الحالية")}
          value={current}
          onChange={setCurrent}
          secure
          disabled={busy}
        />
        {data?.mfa_allowed && (
          <Input
            label={
              secret
                ? t(
                    "Code à 6 chiffres de l’application d’authentification",
                    "الرمز المكون من 6 أرقام من تطبيق المصادقة",
                  )
                : t(
                    "Code de double authentification ou de secours (si activée)",
                    "رمز المصادقة الثنائية أو الاسترداد (عند التفعيل)",
                  )
            }
            value={code}
            onChange={setCode}
            disabled={busy}
          />
        )}
        <Button
          title={t(
            "Confirmer mon identité pour 10 minutes",
            "تأكيد هويتي لمدة 10 دقائق",
          )}
          disabled={busy || !current || !!secret}
          onPress={() =>
            void run(async () => {
              await api("security/reauthenticate", "POST", proof());
              setMessage(
                t(
                  "Identité confirmée dans cette session mobile pour 10 minutes.",
                  "تم تأكيد هويتك في جلسة الهاتف لمدة 10 دقائق.",
                ),
              );
            })
          }
        />
        {data?.mfa_allowed && !data.mfa_enabled && !secret && (
          <Button
            title={t(
              "Préparer la double authentification",
              "إعداد المصادقة الثنائية",
            )}
            disabled={busy || !current || !data.mfa_available}
            onPress={() =>
              void run(async () => {
                const d = await api("security/mfa/setup", "POST", proof());
                setSecret(d.secret);
              })
            }
          />
        )}
        {secret && (
          <>
            <Text style={ui.text}>
              {t(
                "Dans votre application d’authentification, ajoutez manuellement un compte EduBest : clé ci-dessous, TOTP, 6 chiffres, 30 secondes. Revenez ici avec le code. La clé reste uniquement en mémoire pendant cet écran. Elle sera masquée en arrière-plan et supprimée en quittant cet écran.",
                "أضف حساب EduBest يدويًا في تطبيق المصادقة: المفتاح أدناه، TOTP، ستة أرقام، 30 ثانية. يبقى المفتاح في الذاكرة خلال هذه الشاشة فقط. يُخفى في الخلفية ويُحذف عند مغادرة الشاشة.",
              )}
            </Text>
            <Text selectable style={{ fontSize: 20, letterSpacing: 2 }}>
              {secret}
            </Text>
            <Text style={ui.text}>
              {t(
                "Utilisez un autre appareil pour lire la clé, ou copiez-la avant de changer d’application. Gardez-la privée.",
                "استخدم جهازًا آخر لقراءة المفتاح أو انسخه قبل تبديل التطبيق. احتفظ به سرًا.",
              )}
            </Text>
            <Button
              title={t("Activer avec le code", "التفعيل باستخدام الرمز")}
              disabled={busy || !current || !code}
              onPress={() =>
                void run(async () => {
                  const d = await api("security/mfa/enable", "POST", proof());
                  setRecovery(d.recovery_codes);
                  setSecret("");
                  setMessage(
                    t(
                      "Protection activée. Conservez vos codes de secours avant de fermer cet écran.",
                      "تم تفعيل الحماية. احفظ رموز الاسترداد قبل إغلاق هذه الشاشة.",
                    ),
                  );
                })
              }
            />
          </>
        )}
        {data?.mfa_enabled && (
          <>
            <Text style={ui.text}>
              {data.recovery_remaining}{" "}
              {t("codes de secours restants", "رموز استرداد متبقية")}
            </Text>
            <Button
              title={t(
                "Renouveler les codes de secours",
                "تجديد رموز الاسترداد",
              )}
              disabled={busy || !current || !code}
              onPress={() =>
                Alert.alert(
                  t("Renouveler les codes ?", "تجديد الرموز؟"),
                  t(
                    "Les anciens codes deviendront invalides et les autres sessions seront déconnectées.",
                    "ستُلغى الرموز القديمة وتُغلق الجلسات الأخرى.",
                  ),
                  [
                    { text: t("Annuler", "إلغاء"), style: "cancel" },
                    {
                      text: t("Renouveler", "تجديد"),
                      onPress: () =>
                        void run(async () => {
                          const d = await api(
                            "security/mfa/recovery",
                            "POST",
                            proof(),
                          );
                          setRecovery(d.recovery_codes);
                        }),
                    },
                  ],
                )
              }
            />
          </>
        )}
      </Panel>
      {recovery.length > 0 && (
        <Panel
          title={t(
            "Codes de secours — affichage unique",
            "رموز الاسترداد — عرض لمرة واحدة",
          )}
        >
          <Text style={ui.text}>
            {t(
              "Conservez-les dans un endroit privé. Chaque code ne fonctionne qu’une fois. Aucun envoi automatique par email ou notification.",
              "احفظها في مكان خاص. يعمل كل رمز مرة واحدة فقط. لا تُرسل تلقائيًا عبر البريد أو الإشعارات.",
            )}
          </Text>
          {recovery.map((c) => (
            <Text key={c} selectable style={{ fontSize: 17 }}>
              {c}
            </Text>
          ))}
          <Button
            title={t("J’ai conservé les codes : masquer", "حفظت الرموز: إخفاء")}
            onPress={() => setRecovery([])}
          />
        </Panel>
      )}
      <Panel title={t("Appareils et sessions", "الأجهزة والجلسات")}>
        {data?.sessions?.map((r: Row) => (
          <View key={r.id} style={{ gap: 6, paddingVertical: 10 }}>
            <Text>
              {r.device_label || t("Appareil connecté", "جهاز متصل")}
              {r.current ? ` · ${t("Cette session", "هذه الجلسة")}` : ""}
            </Text>
            <Text style={ui.text}>
              {t("Dernière activité", "آخر نشاط")} : {when(r.last_seen_at)}
            </Text>
            {!r.current && (
              <Button
                title={t("Déconnecter cet appareil", "فصل هذا الجهاز")}
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await api("security/reauthenticate", "POST", proof());
                    await api("security/sessions/revoke", "POST", { id: r.id });
                    setMessage(t("Appareil déconnecté.", "تم فصل الجهاز."));
                  })
                }
              />
            )}
          </View>
        ))}
        <Button
          title={t("Actualiser l’état", "تحديث الحالة")}
          disabled={busy}
          onPress={() => void run(refresh)}
        />
      </Panel>
    </View>
  );
}
