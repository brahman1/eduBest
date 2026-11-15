import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import {
  registrationCopy as publicText,
  registrationReviewCopy as staffText,
  registrationInput,
  schoolLevelLabel,
  schoolLevelOptions,
  type RegistrationCourse,
  type RegistrationRequest,
  type RegistrationDossier,
} from "@edubest/shared";
import { api, WEBSITE } from "./api";
import { Button, Input, Panel, ui } from "./NativeUi";
import { theme } from "./theme";

function Check({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onChange}
      style={{
        minHeight: 46,
        padding: 10,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: checked ? theme.action : theme.line,
        backgroundColor: checked ? theme.softBlue : theme.paper,
        justifyContent: "center",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ color: theme.ink }}>
        {checked ? "✓" : "□"} {label}
      </Text>
    </Pressable>
  );
}

export function RegistrationForm({
  ar,
  onBack,
}: {
  ar: boolean;
  onBack: () => void;
}) {
  const copy = (key: keyof typeof publicText) => publicText[key][ar ? 1 : 0];
  const [role, setRole] = useState<"STUDENT" | "PARENT">("STUDENT");
  const [kind, setKind] = useState<"new" | "existing">("new");
  const [values, setValues] = useState<Record<string, string>>({});
  const [catalog, setCatalog] = useState<{
    enabled: boolean;
    courses: RegistrationCourse[];
  }>();
  const [choices, setChoices] = useState<string[]>([]);
  const [choosingLevel, setChoosingLevel] = useState(false);
  const [customLevel, setCustomLevel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setCatalogFailed(false);
    try {
      const data = await api("registrations/catalog");
      setCatalog(data);
      setChoices((old) =>
        old.filter((id) =>
          data.courses.some((c: RegistrationCourse) => c.id === id && !c.full),
        ),
      );
    } catch {
      setCatalogFailed(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    const parsed = registrationInput.safeParse({
      role,
      student_kind: kind,
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email,
      phone: values.phone,
      locale: ar ? "ar" : "fr",
      ...(role === "PARENT"
        ? {
            child_first_name: values.child_first_name,
            child_last_name: values.child_last_name,
          }
        : {}),
      ...(kind === "new"
        ? { level: schoolLevelLabel(values.level ?? "") }
        : {}),
      group_ids: kind === "new" ? choices : [],
      acknowledged: checked,
    });
    if (!parsed.success) {
      setError(copy("invalid"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("registrations/request", "POST", parsed.data);
      setSent(true);
      setValues({});
      setChoices([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const field = (
    name: string,
    label: keyof typeof publicText | undefined,
    length = 60,
    keyboardType?: "phone-pad" | "email-address",
  ) => (
    <Input
      label={
        (label ? copy(label) : ar ? "حدّد المستوى" : "Précisez le niveau") +
        " *"
      }
      value={values[name] ?? ""}
      maxLength={length}
      keyboardType={keyboardType}
      disabled={busy}
      onChange={(value) => setValues((old) => ({ ...old, [name]: value }))}
    />
  );
  const courses = catalog?.courses ?? [];
  const available = courses.some((course) => !course.full);
  const levels = schoolLevelOptions(
    courses.map((course) => course.level),
    ar ? "ar" : "fr",
  );
  return (
    <Panel title={copy("title")}>
      {sent ? (
        <Text accessibilityLiveRegion="polite" style={ui.success}>
          {copy("sent")}
        </Text>
      ) : catalog?.enabled === false ? (
        <>
          <Text style={ui.text}>{copy("unavailable")}</Text>
          <Button
            title={staffText.refresh[ar ? 1 : 0]}
            disabled={loading}
            onPress={() => void load()}
          />
        </>
      ) : (
        <>
          <Text style={ui.text}>{copy("intro")}</Text>
          <View style={ui.row}>
            <Button
              title={copy("student")}
              disabled={busy}
              selected={role === "STUDENT"}
              onPress={() => setRole("STUDENT")}
            />
            <Button
              title={copy("parent")}
              disabled={busy}
              selected={role === "PARENT"}
              onPress={() => setRole("PARENT")}
            />
          </View>
          <View style={ui.row}>
            <Button
              title={copy("newStudent")}
              disabled={busy}
              selected={kind === "new"}
              onPress={() => setKind("new")}
            />
            <Button
              title={copy("existing")}
              disabled={busy}
              selected={kind === "existing"}
              onPress={() => setKind("existing")}
            />
          </View>
          {field("first_name", "firstName")}
          {field("last_name", "lastName")}
          {field("phone", "phone", 32, "phone-pad")}
          {field("email", "email", 254, "email-address")}
          {role === "PARENT" && (
            <>
              {field("child_first_name", "childFirstName")}
              {field("child_last_name", "childLastName")}
            </>
          )}
          {kind === "new" && (
            <>
              <Text style={ui.title}>{copy("level")} *</Text>
              <Button
                title={
                  customLevel
                    ? ar
                      ? "مستوى آخر"
                      : "Autre niveau"
                    : values.level ||
                      (ar ? "اختر المستوى" : "Choisir un niveau")
                }
                disabled={busy}
                onPress={() => setChoosingLevel(!choosingLevel)}
              />
              {choosingLevel && (
                <View style={ui.row}>
                  {levels.map((level) => (
                    <Button
                      key={level}
                      title={level}
                      selected={!customLevel && values.level === level}
                      onPress={() => {
                        setCustomLevel(false);
                        setValues((old) => ({ ...old, level }));
                        setChoosingLevel(false);
                      }}
                    />
                  ))}
                  <Button
                    title={ar ? "مستوى آخر" : "Autre niveau"}
                    onPress={() => {
                      if (!customLevel)
                        setValues((old) => ({ ...old, level: "" }));
                      setCustomLevel(true);
                      setChoosingLevel(false);
                    }}
                  />
                </View>
              )}
              {customLevel && field("level", undefined, 100)}
              <Text accessibilityRole="header" style={ui.title}>
                {copy("courses")}
              </Text>
              <Text style={ui.text}>
                {loading
                  ? ar
                    ? "جارٍ تحميل الدروس…"
                    : "Chargement des cours…"
                  : catalogFailed
                    ? ar
                      ? "تعذّر تحديث الدروس."
                      : "Impossible d’actualiser les cours."
                    : available
                      ? copy("coursesHelp")
                      : ar
                        ? "لا توجد أماكن متاحة حاليًا."
                        : "Aucun cours avec une place disponible pour le moment."}
              </Text>
              <Text style={ui.text}>
                {ar
                  ? "يمكنك إرسال الطلب دون اختيار درس. ستساعدك المدرسة في الاختيار."
                  : "Vous pouvez envoyer votre demande sans choisir de cours. L’école pourra vous orienter."}
              </Text>
              <Button
                title={staffText.refresh[ar ? 1 : 0]}
                disabled={busy || loading}
                onPress={() => void load()}
              />
              {courses.map((course) => (
                <Check
                  key={course.id}
                  label={[
                    course.name,
                    course.subject,
                    schoolLevelLabel(course.level),
                    course.full ? copy("full") : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  checked={choices.includes(course.id)}
                  disabled={
                    busy ||
                    course.full ||
                    (choices.length >= 10 && !choices.includes(course.id))
                  }
                  onChange={() =>
                    setChoices((old) =>
                      old.includes(course.id)
                        ? old.filter((id) => id !== course.id)
                        : [...old, course.id],
                    )
                  }
                />
              ))}
            </>
          )}
          <Button
            title={copy("privacy")}
            onPress={() => void Linking.openURL(`${WEBSITE}/legal`)}
          />
          <Check
            label={copy("acknowledgement")}
            checked={checked}
            disabled={busy}
            onChange={() => setChecked(!checked)}
          />
          {error && (
            <Text accessibilityRole="alert" style={ui.error}>
              {error}
            </Text>
          )}
          <Button
            title={
              busy ? (ar ? "جارٍ الإرسال…" : "Envoi en cours…") : copy("submit")
            }
            selected
            disabled={busy}
            onPress={() => void submit()}
          />
        </>
      )}
      <Button title={copy("signIn")} onPress={onBack} disabled={busy} />
    </Panel>
  );
}

type Tab = "pending" | "history" | "catalog";
type Copy = (key: keyof typeof staffText) => string;
type CatalogCourse = RegistrationCourse & { registration_open: boolean };

export function MobileRegistrations({
  ar,
  admin,
  onSecurity,
}: {
  ar: boolean;
  admin: boolean;
  onSecurity: () => void;
}) {
  const copy: Copy = (key) => staffText[key][ar ? 1 : 0];
  const [tab, setTab] = useState<Tab>("pending");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<RegistrationRequest[]>([]);
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [more, setMore] = useState(false);
  const [active, setActive] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  async function load(current: Tab, skip: number) {
    const seq = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const data = await api(
        current === "catalog"
          ? "registrations/catalog/manage"
          : `registrations?history=${current === "history"}&offset=${skip}`,
      );
      if (seq !== generation.current) return;
      if (current === "catalog") setCatalog(data);
      else {
        setRows(data.requests);
        setMore(data.has_more);
      }
    } catch (e) {
      if (seq === generation.current) setError((e as Error).message);
    } finally {
      if (seq === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load(tab, offset);
    return () => {
      generation.current++;
    };
  }, [tab, offset]);
  async function update(path: string, body?: unknown, method = "POST") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(path, method, body);
      setNotice(copy(method === "PATCH" ? "saved" : "sent"));
      setActive("");
      await load(tab, offset);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 14 }} accessibilityLanguage={ar ? "ar" : "fr"}>
      <View style={ui.row}>
        {(["pending", "history", ...(admin ? ["catalog"] : [])] as Tab[]).map(
          (item) => (
            <Button
              key={item}
              title={copy(item)}
              selected={tab === item}
              disabled={busy}
              onPress={() => {
                setActive("");
                setOffset(0);
                setNotice("");
                setTab(item);
              }}
            />
          ),
        )}
        <Button
          title={copy("refresh")}
          disabled={busy || loading}
          onPress={() => void load(tab, offset)}
        />
      </View>
      <Text style={ui.text}>{copy("identity")}</Text>
      <Button title={copy("security")} disabled={busy} onPress={onSecurity} />
      {error && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
      {notice && (
        <Text accessibilityLiveRegion="polite" style={ui.success}>
          {notice}
        </Text>
      )}
      {loading ? (
        <Text>{ar ? "جاري التحميل…" : "Chargement…"}</Text>
      ) : tab === "catalog" ? (
        <>
          <Text style={ui.text}>{copy("catalogueHelp")}</Text>
          {catalog.map((course) => (
            <Panel key={course.id} title={course.name}>
              <Text style={ui.text}>
                {[
                  course.subject,
                  course.level,
                  copy(course.registration_open ? "visible" : "hidden"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Button
                title={copy(course.registration_open ? "close" : "open")}
                disabled={busy}
                onPress={() =>
                  void update(
                    `registrations/catalog/${course.id}`,
                    { open: !course.registration_open },
                    "PATCH",
                  )
                }
              />
            </Panel>
          ))}
        </>
      ) : (
        <>
          {!rows.length && <Text style={ui.text}>{copy("empty")}</Text>}
          {rows.map((row) => (
            <Panel key={row.id} title={`${row.first_name} ${row.last_name}`}>
              <Text style={ui.text}>
                {row.role === "PARENT"
                  ? ar
                    ? "ولي"
                    : "Parent"
                  : ar
                    ? "تلميذ"
                    : "Élève"}{" "}
                ·{" "}
                {new Date(row.created_at).toLocaleDateString(
                  ar ? "ar-DZ" : "fr-DZ",
                  { timeZone: "Africa/Algiers" },
                )}
              </Text>
              <Text style={ui.text}>
                {row.email} · {row.phone}
              </Text>
              {row.child_first_name && (
                <Text style={ui.text}>
                  {copy("child")} · {row.child_first_name} {row.child_last_name}
                </Text>
              )}
              {row.level && <Text style={ui.text}>{row.level}</Text>}
              {row.courses.length > 0 && (
                <Text style={ui.text}>
                  {row.courses.map((course) => course.name).join(" · ")}
                </Text>
              )}
              {row.status !== "pending" ? (
                <>
                  <Text style={ui.text}>
                    {copy(row.status)}
                    {row.reason && " · " + row.reason}
                  </Text>
                  {row.can_resend && (
                    <Button
                      title={copy("resend")}
                      disabled={busy}
                      onPress={() =>
                        void update(`registrations/${row.id}/resend`)
                      }
                    />
                  )}
                </>
              ) : active === row.id ? (
                <Decision
                  row={row}
                  copy={copy}
                  ar={ar}
                  busy={busy}
                  update={update}
                />
              ) : (
                <Button
                  title={copy("review")}
                  disabled={busy}
                  onPress={() => setActive(row.id)}
                />
              )}
            </Panel>
          ))}
          <View style={ui.row}>
            {offset > 0 && (
              <Button
                title={copy("previous")}
                disabled={busy}
                onPress={() => {
                  setActive("");
                  setOffset(offset - 50);
                }}
              />
            )}
            {more && (
              <Button
                title={copy("next")}
                disabled={busy}
                onPress={() => {
                  setActive("");
                  setOffset(offset + 50);
                }}
              />
            )}
          </View>
        </>
      )}
    </View>
  );
}

function Decision({
  row,
  copy,
  ar,
  busy,
  update,
}: {
  row: RegistrationRequest;
  copy: Copy;
  ar: boolean;
  busy: boolean;
  update: (path: string, body: unknown) => Promise<void>;
}) {
  const isNew = row.student_kind === "new";
  const [groups, setGroups] = useState(
    row.courses
      .filter((course) => course.active && !course.full)
      .map((course) => course.id),
  );
  const [query, setQuery] = useState(row.child_last_name ?? row.last_name);
  const [matches, setMatches] = useState<RegistrationDossier[] | null>(null);
  const [selected, setSelected] = useState<RegistrationDossier>();
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  async function search() {
    setError("");
    setSearching(true);
    try {
      setMatches(
        await api(
          `registrations/dossiers?q=${encodeURIComponent(query.trim())}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      {error && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
      <Input
        label={copy("find")}
        value={query}
        onChange={setQuery}
        maxLength={120}
        disabled={busy}
      />
      <Button
        title={copy("search")}
        disabled={busy || searching || query.trim().length < 2}
        onPress={() => void search()}
      />
      {isNew && selected && (
        <Button
          title={copy("useNew")}
          disabled={busy}
          onPress={() => setSelected(undefined)}
        />
      )}
      {selected && (
        <Text style={ui.success}>
          {copy("child")} · {selected.name} · {selected.level}
        </Text>
      )}
      {matches &&
        (matches.length ? (
          matches.map((dossier) => (
            <Button
              key={dossier.id}
              title={`${dossier.name} ${dossier.level}${(row.role === "STUDENT" && dossier.has_login) || (row.role === "PARENT" && dossier.has_parent) ? " · " + copy("linked") : ""}`}
              selected={selected?.id === dossier.id}
              disabled={busy || (row.role === "STUDENT" && dossier.has_login)}
              onPress={() => setSelected(dossier)}
            />
          ))
        ) : (
          <Text style={ui.text}>{copy("noMatches")}</Text>
        ))}
      {isNew && (
        <>
          <Text style={ui.title}>{copy("groups")}</Text>
          {!groups.length && (
            <Text style={ui.text}>{copy("noConfirmedGroups")}</Text>
          )}
          {row.courses.map((course) => (
            <Check
              key={course.id}
              label={
                course.name +
                (!course.active
                  ? " · " + copy("inactive")
                  : course.full
                    ? " · " + (ar ? "مكتمل" : "Complet")
                    : "")
              }
              checked={groups.includes(course.id)}
              disabled={busy || !course.active || (course.full && !selected)}
              onChange={() =>
                setGroups((old) =>
                  old.includes(course.id)
                    ? old.filter((id) => id !== course.id)
                    : [...old, course.id],
                )
              }
            />
          ))}
        </>
      )}
      <Check
        label={copy("checked")}
        checked={checked}
        disabled={busy}
        onChange={() => setChecked(!checked)}
      />
      <Button
        title={copy("approve")}
        selected
        disabled={busy || !checked || (!isNew && !selected)}
        onPress={() =>
          void update(`registrations/${row.id}/approve`, {
            identity_checked: true,
            student_id: selected?.id,
            group_ids: isNew ? groups : [],
          })
        }
      />
      <Input
        label={copy("reason")}
        value={reason}
        onChange={setReason}
        maxLength={500}
        disabled={busy}
        multiline
      />
      <Button
        title={copy("reject")}
        disabled={busy || reason.trim().length < 5}
        onPress={() =>
          void update(`registrations/${row.id}/reject`, { reason })
        }
      />
    </View>
  );
}
