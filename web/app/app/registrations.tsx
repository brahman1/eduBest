"use client";

import { useEffect, useRef, useState } from "react";
import {
  registrationReviewCopy as texts,
  type RegistrationRequest,
  type RegistrationCourse,
  type RegistrationDossier,
} from "@edubest/shared";
import { api, localDate } from "../../lib/api";
import "../inscription/registration.css";

type Tab = "pending" | "history" | "catalog";
type Copy = (key: keyof typeof texts) => string;
type CatalogCourse = RegistrationCourse & { registration_open: boolean };

export default function Registrations({
  ar,
  admin,
  onSecurity,
}: {
  ar: boolean;
  admin: boolean;
  onSecurity: () => void;
}) {
  const copy: Copy = (key) => texts[key][ar ? 1 : 0];
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
  function changeTab(next: Tab) {
    setActive("");
    setNotice("");
    setOffset(0);
    setTab(next);
  }
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
  const button = (
    key: keyof typeof texts,
    click: () => void,
    disabled = busy,
    primary = false,
  ) => (
    <button
      type="button"
      className={primary ? "button dark" : "button light"}
      disabled={disabled}
      onClick={click}
    >
      {copy(key)}
    </button>
  );

  return (
    <section
      className="registration-panel"
      aria-label={ar ? "التسجيلات" : "Inscriptions"}
    >
      <div className="registration-actions">
        {(["pending", "history", ...(admin ? ["catalog"] : [])] as Tab[]).map(
          (item) => (
            <button
              className={tab === item ? "button dark" : "button light"}
              type="button"
              key={item}
              aria-pressed={tab === item}
              disabled={busy}
              onClick={() => changeTab(item)}
            >
              {copy(item)}
            </button>
          ),
        )}
        {button("refresh", () => void load(tab, offset), busy || loading)}
      </div>
      <div className="registration-info">
        {copy("identity")}{" "}
        <button className="text-button" type="button" onClick={onSecurity}>
          {copy("security")}
        </button>
      </div>
      {error && (
        <p className="registration-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="registration-info" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">{ar ? "جاري التحميل…" : "Chargement…"}</p>
      ) : tab === "catalog" ? (
        <>
          <p>{copy("catalogueHelp")}</p>
          {catalog.map((course) => (
            <article key={course.id}>
              <h3>{course.name}</h3>
              <p>
                {[
                  course.subject,
                  course.level,
                  copy(course.registration_open ? "visible" : "hidden"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div>
                {button(
                  course.registration_open ? "close" : "open",
                  () =>
                    void update(
                      `registrations/catalog/${course.id}`,
                      { open: !course.registration_open },
                      "PATCH",
                    ),
                )}
              </div>
            </article>
          ))}
        </>
      ) : (
        <>
          {!rows.length && <p>{copy("empty")}</p>}
          {rows.map((row) => (
            <article key={row.id}>
              <h3>
                {row.first_name} {row.last_name}
              </h3>
              <p>
                {row.role === "PARENT"
                  ? ar
                    ? "ولي"
                    : "Parent"
                  : ar
                    ? "تلميذ"
                    : "Élève"}{" "}
                · {localDate(row.created_at)}
              </p>
              <p>
                <bdi>{row.email}</bdi> · <bdi>{row.phone}</bdi>
              </p>
              {row.child_first_name && (
                <p>
                  {copy("child")} · {row.child_first_name} {row.child_last_name}
                </p>
              )}
              {row.level && <p>{row.level}</p>}
              {row.courses.length > 0 && (
                <p>{row.courses.map((course) => course.name).join(" · ")}</p>
              )}
              {row.status !== "pending" ? (
                <>
                  <p>
                    <strong>{copy(row.status)}</strong>
                    {row.reason && " · " + row.reason}
                  </p>
                  {row.can_resend && (
                    <div>
                      {button(
                        "resend",
                        () => void update(`registrations/${row.id}/resend`),
                      )}
                    </div>
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
                <div>{button("review", () => setActive(row.id))}</div>
              )}
            </article>
          ))}
          <div className="registration-actions">
            {offset > 0 &&
              button(
                "previous",
                () => {
                  setActive("");
                  setOffset(offset - 50);
                },
                busy,
              )}
            {more &&
              button(
                "next",
                () => {
                  setActive("");
                  setOffset(offset + 50);
                },
                busy,
              )}
          </div>
        </>
      )}
    </section>
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
    <div className="registration-form">
      {error && (
        <p className="registration-error" role="alert">
          {error}
        </p>
      )}
      <label>
        {copy("find")}
        <input
          value={query}
          maxLength={120}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="registration-actions">
        <button
          className="button light"
          disabled={busy || searching || query.trim().length < 2}
          type="button"
          onClick={() => void search()}
        >
          {copy("search")}
        </button>
        {isNew && selected && (
          <button
            className="button light"
            type="button"
            onClick={() => setSelected(undefined)}
          >
            {copy("useNew")}
          </button>
        )}
      </div>
      {selected && (
        <p className="registration-info">
          {copy("child")} · <strong>{selected.name}</strong> · {selected.level}
        </p>
      )}
      {matches && (
        <div className="registration-actions">
          {matches.length ? (
            matches.map((dossier) => (
              <button
                key={dossier.id}
                type="button"
                className={
                  dossier.id === selected?.id ? "button dark" : "button light"
                }
                disabled={busy || (row.role === "STUDENT" && dossier.has_login)}
                onClick={() => setSelected(dossier)}
              >
                {dossier.name} {dossier.level}{" "}
                {(row.role === "STUDENT" && dossier.has_login) ||
                (row.role === "PARENT" && dossier.has_parent)
                  ? " · " + copy("linked")
                  : ""}
              </button>
            ))
          ) : (
            <p>{copy("noMatches")}</p>
          )}
        </div>
      )}
      {isNew && (
        <fieldset className="registration-options">
          <legend>{copy("groups")}</legend>
          {!groups.length && <p>{copy("noConfirmedGroups")}</p>}
          {row.courses.map((course) => (
            <label key={course.id}>
              <input
                type="checkbox"
                disabled={busy || !course.active || (course.full && !selected)}
                checked={groups.includes(course.id)}
                onChange={(e) =>
                  setGroups(
                    e.target.checked
                      ? [...groups, course.id]
                      : groups.filter((id) => id !== course.id),
                  )
                }
              />
              {course.name}{" "}
              {!course.active
                ? " · " + copy("inactive")
                : course.full
                  ? " · " + (ar ? "مكتمل" : "Complet")
                  : ""}
            </label>
          ))}
        </fieldset>
      )}
      <label className="registration-check">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        {copy("checked")}
      </label>
      <div>
        <button
          className="button dark"
          type="button"
          disabled={busy || !checked || (!isNew && !selected)}
          onClick={() =>
            void update(`registrations/${row.id}/approve`, {
              identity_checked: true,
              student_id: selected?.id,
              group_ids: isNew ? groups : [],
            })
          }
        >
          {copy("approve")}
        </button>
      </div>
      <label>
        {copy("reason")}
        <textarea
          value={reason}
          maxLength={500}
          rows={2}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div>
        <button
          className="button light"
          type="button"
          disabled={busy || reason.trim().length < 5}
          onClick={() =>
            void update(`registrations/${row.id}/reject`, { reason })
          }
        >
          {copy("reject")}
        </button>
      </div>
    </div>
  );
}
