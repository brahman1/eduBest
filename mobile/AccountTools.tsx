import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { raw } from "./api";
import { theme } from "./theme";
import { User, dinars, pageLabel } from "@edubest/shared";
type Row = Record<string, any>;
export function AttendanceStats({ data, ar }: { data: Row; ar: boolean }) {
  return (
    <View
      style={{
        gap: 12,
        backgroundColor: theme.surface,
        padding: 18,
        borderRadius: 12,
      }}
    >
      <Text style={{ fontWeight: "700", color: theme.ink }}>
        {ar ? "الحضور والغياب" : "Présences et absences"}
      </Text>
      <Text>
        {data.from} — {data.to}
      </Text>
      <Text style={{ color: theme.muted }}>
        {ar
          ? "الحصص المنتهية؛ التأخر ضمن الحضور. غير المسجل مستبعد."
          : "Séances terminées. Retards inclus dans la présence ; non renseignés exclus des taux."}
      </Text>
      {[
        ["students", ar ? "حسب التلميذ" : "Par élève"],
        [
          "teachers",
          ar
            ? "حضور التلاميذ حسب الأستاذ"
            : "Présence des élèves par enseignant",
        ],
      ].map(([key, title]) => (
        <View key={key} style={{ gap: 8 }}>
          <Text style={{ fontWeight: "600" }}>{title}</Text>
          {data[key]?.map((r: Row) => (
            <View
              key={r.id ?? "none"}
              style={{
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderColor: theme.line,
              }}
            >
              <Text>{r.name}</Text>
              <Text>
                {ar ? "الحضور" : "Présence"} :{" "}
                {r.presence_rate === null ? "—" : `${r.presence_rate}%`} (
                {r.present + r.late}/{r.marked}) · {ar ? "الغياب" : "Absence"} :{" "}
                {r.absence_rate === null ? "—" : `${r.absence_rate}%`} (
                {r.absent})
              </Text>
              <Text style={{ color: theme.muted }}>
                {ar ? "متأخر / غير مسجل" : "Retards / non renseignés"} :{" "}
                {r.late} / {r.unmarked}
              </Text>
            </View>
          ))}
          {!data[key]?.length && (
            <Text>{ar ? "لا يوجد نداء مسجل." : "Aucun appel renseigné."}</Text>
          )}
        </View>
      ))}
    </View>
  );
}
export function MobileExports({ ar }: { ar: boolean }) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Algiers",
  });
  const [from, setFrom] = useState(today.slice(0, 7) + "-01"),
    [to, setTo] = useState(today),
    [dataset, setDataset] = useState("all"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const button = (label: string, click: () => void) => (
    <Pressable
      disabled={busy}
      onPress={click}
      style={{
        padding: 12,
        backgroundColor: theme.soft,
        borderRadius: 8,
        marginVertical: 4,
      }}
    >
      <Text style={{ color: theme.ink }}>{label}</Text>
    </Pressable>
  );
  async function download(format: string) {
    setBusy(true);
    setError("");
    try {
      const r = await raw(
        `reports/export?${new URLSearchParams({ from, to, dataset, format })}`,
      );
      if (!r.ok)
        throw new Error((await r.json()).message ?? "Export indisponible");
      const bytes = new Uint8Array(await r.arrayBuffer()),
        name = `edubest-${dataset}-${from}-${to}.${format}`;
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(new Blob([bytes])),
          a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        if (!(await Sharing.isAvailableAsync()))
          throw new Error(ar ? "المشاركة غير متاحة" : "Partage indisponible");
        const file = new File(Paths.cache, name);
        file.create({ overwrite: true });
        file.write(bytes);
        try {
          await Sharing.shareAsync(file.uri, {
            mimeType:
              format === "xlsx"
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "application/json",
            UTI:
              format === "xlsx"
                ? "org.openxmlformats.spreadsheetml.sheet"
                : "public.json",
          });
        } finally {
          file.delete();
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View
      style={{
        gap: 10,
        padding: 18,
        backgroundColor: theme.surface,
        borderRadius: 12,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "700" }}>
        {ar ? "التصدير والتقارير" : "Exports & bilans"}
      </Text>
      <Text>
        {ar
          ? "أكد هويتك بكلمة المرور قبل تصدير البيانات. الفترة حسب توقيت الجزائر، ولا تصفي قوائم الأسماء."
          : "Confirmez votre identité avant l’export. Période en heure d’Alger ; les annuaires ne sont pas filtrés par date."}
      </Text>
      <Text>{ar ? "من YYYY-MM-DD" : "Du AAAA-MM-JJ"}</Text>
      <TextInput
        style={{ borderWidth: 1, padding: 10, borderColor: theme.line }}
        value={from}
        onChangeText={setFrom}
      />
      <Text>{ar ? "إلى YYYY-MM-DD" : "Au AAAA-MM-JJ"}</Text>
      <TextInput
        style={{ borderWidth: 1, padding: 10, borderColor: theme.line }}
        value={to}
        onChangeText={setTo}
      />
      {[
        ["all", "Tout", "الكل"],
        ["students", "Élèves", "التلاميذ"],
        ["parents", "Parents", "الأولياء"],
        ["teachers", "Enseignants", "الأساتذة"],
        ["finance", "Bilan financier", "الحصيلة المالية"],
        ["attendance", "Présences", "الحضور"],
      ].map(([v, f, a]) => (
        <View key={v}>
          {button(`${dataset === v ? "✓ " : ""}${ar ? a : f}`, () =>
            setDataset(v),
          )}
        </View>
      ))}
      {button("Excel (.xlsx)", () => void download("xlsx"))}
      {button("JSON", () => void download("json"))}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: theme.danger }}>
          {error}
        </Text>
      )}
    </View>
  );
}
