import { useState, useSyncExternalStore } from "react";
import { SIMPLE_ENGLISH } from "./simple-copy";
import { LANGUAGES } from "../../shared/types";
import { PARAMETER_QUESTIONS } from "../../shared/repair-questions";
import type { RepairQuestion } from "../../shared/types";

export const UI_LANGUAGES = LANGUAGES.filter((l) => l.code !== "auto");
const dictionaries: Record<string, Record<string, string>> = { en: {} };
const loaders = {
  hi: () => import("./locales/hi.json"),
  mr: () => import("./locales/mr.json"),
  te: () => import("./locales/te.json"),
  bn: () => import("./locales/bn.json"),
  od: () => import("./locales/od.json"),
};
const key = "strive.ui-language";
const valid = (value: string | null) =>
  UI_LANGUAGES.some((l) => l.code === value);
let language = "en-IN";
let savedLanguage = "en-IN",
  languageRequest = 0;
try {
  const saved = localStorage.getItem(key);
  if (valid(saved)) savedLanguage = saved!;
} catch {
  /* storage is optional */
}
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function useLanguage() {
  return useSyncExternalStore(
    subscribe,
    () => language,
    () => "en-IN",
  );
}
export async function setLanguage(value: string) {
  if (!valid(value)) return;
  const request = ++languageRequest;
  const code = value.split("-")[0]!;
  if (!dictionaries[code])
    dictionaries[code] = (
      await loaders[code as keyof typeof loaders]()
    ).default;
  if (request !== languageRequest) return;
  language = value;
  // Odia's BCP 47 code is or; input/API code remains od-IN.
  document.documentElement.lang = value === "od-IN" ? "or-IN" : value;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* keep in memory */
  }
  listeners.forEach((fn) => fn());
}
if (typeof document !== "undefined")
  document.documentElement.lang = language === "od-IN" ? "or-IN" : language;
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key !== key) return;
    void setLanguage(valid(event.newValue) ? event.newValue! : "en-IN");
  });
if (savedLanguage !== language) void setLanguage(savedLanguage).catch(() => {});
/** Use only for application copy and fixed questions, never source evidence or user names. */
export function t(
  text: string | undefined,
  values: Record<string, string | number> = {},
): string {
  if (text === undefined) return "";
  const complete =
    /^(\d+)% of the core information areas are supplied\. Completeness is shown separately from the weighted assessment\.$/.exec(
      text,
    );
  if (complete)
    return t(
      "{value}% of the 14 main details were found. This is separate from the total score.",
      { value: complete[1]! },
    );
  const evidence =
    /^(\d+) of (\d+) evidence areas supplied\. (The proposal describes this dimension\.|Further information is needed\.) This rates the supporting information, not predicted business success\.$/.exec(
      text,
    );
  if (evidence)
    return (
      t("{provided} of {total} evidence areas supplied.", {
        provided: evidence[1]!,
        total: evidence[2]!,
      }) +
      " " +
      t(evidence[3]) +
      " " +
      t(
        "This rates the supporting information, not predicted business success.",
      )
    );
  const template =
    dictionaries[language.split("-")[0]!]?.[text] ??
    SIMPLE_ENGLISH[text] ??
    text;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    String(values[name] ?? match),
  );
}
export function questionText(question: RepairQuestion) {
  const prefix = question.question.startsWith("The input contains conflicting")
    ? t("The input contains conflicting or unclear answers. Please confirm:") +
      " "
    : "";
  return prefix + t(PARAMETER_QUESTIONS[question.field].question);
}
export function LanguageControl() {
  const selected = useLanguage();
  const [pending, setPending] = useState(false),
    [error, setError] = useState(false);
  return (
    <label className="language-control">
      <span>{t("Website language")}</span>
      <select
        aria-label="Website language"
        value={selected}
        disabled={pending}
        onChange={async (e) => {
          setPending(true);
          setError(false);
          try {
            await setLanguage(e.target.value);
          } catch {
            setError(true);
          } finally {
            setPending(false);
          }
        }}
      >
        {UI_LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
      {error && (
        <small role="alert">
          {t("Language could not be loaded. Please try again.")}
        </small>
      )}
    </label>
  );
}
