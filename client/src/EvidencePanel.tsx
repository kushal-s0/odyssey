// localized-ui
import { t, useLanguage } from "./i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  Search,
} from "lucide-react";
import type { SourceSegment, Submission } from "../../shared/types";
import { FIELD_LABELS } from "../../shared/types";
import { download } from "./api";
import { Modal } from "./components";
function time(value: number) {
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}
function Highlight({ text, values }: { text: string; values: string[] }) {
  useLanguage();
  const terms = values
    .filter((v) => v.trim().length > 1)
    .sort((a, b) => b.length - a.length);
  const chunks: { text: string; mark: boolean }[] = [];
  let position = 0;
  while (position < text.length) {
    let index = -1,
      term = "";
    for (const value of terms) {
      const found = text.toLowerCase().indexOf(value.toLowerCase(), position);
      if (found >= 0 && (index < 0 || found < index)) {
        index = found;
        term = value;
      }
    }
    if (index < 0) {
      chunks.push({ text: text.slice(position), mark: false });
      break;
    }
    if (index > position)
      chunks.push({ text: text.slice(position, index), mark: false });
    chunks.push({ text: text.slice(index, index + term.length), mark: true });
    position = index + term.length;
  }
  return (
    <>
      {chunks.map((c, i) => (c.mark ? <mark key={i}>{c.text}</mark> : c.text))}
    </>
  );
}
export default function EvidencePanel({
  record,
  selected,
  onSelect,
  mode,
  onModeChange,
  onVerify,
  busy,
  readOnly,
}: {
  record: Submission;
  selected: string[];
  onSelect: (ids: string[]) => void;
  mode: string;
  onModeChange: (mode: string) => void;
  onVerify: () => void;
  busy: boolean;
  readOnly: boolean;
}) {
  useLanguage();
  const a = record.assessment!,
    [expanded, setExpanded] = useState(false),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [onlySelected, setOnlySelected] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [notice, setNotice] = useState("");
  const audio = useRef<HTMLAudioElement>(null),
    list = useRef<HTMLDivElement>(null);
  const active = a.segments.find((s) => s.id === selected[0]);
  const selectedKey = selected.join("|");
  useEffect(() => {
    setConfirmed(false);
    setNotice("");
    if (selected.length) {
      setOnlySelected(true);
      setQuery("");
      setFilter("all");
    }
  }, [selectedKey, a.version]);
  useEffect(() => {
    if (active && list.current) {
      const el = Array.from(
        list.current.querySelectorAll<HTMLElement>("[data-segment]"),
      ).find((e) => e.dataset.segment === active.id);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedKey, expanded, mode, onlySelected]);
  const visible = useMemo(
    () =>
      a.segments.filter(
        (s) =>
          (!onlySelected || selected.includes(s.id)) &&
          (filter === "all" ||
            (filter === "checked" ? s.verified : !s.verified)) &&
          `${s.id} ${s.originalText} ${s.englishText} ${a.fields
            .filter((f) => f.evidenceIds.includes(s.id))
            .map((f) => FIELD_LABELS[f.key])
            .join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase().trim()),
      ),
    [a, selectedKey, onlySelected, query, filter],
  );
  function url(s?: SourceSegment) {
    return s?.clarificationId
      ? `/api/submissions/${record.id}/clarifications/${s.clarificationId}/source`
      : `/api/submissions/${record.id}/source`;
  }
  function locate(s: SourceSegment) {
    onSelect([s.id]);
    onModeChange("file");
  }
  function seek() {
    if (audio.current && active?.startSeconds != null)
      audio.current.currentTime = active.startSeconds;
  }
  useEffect(() => {
    seek();
  }, [active?.id, mode, expanded]);
  function exportEvidence() {
    const segments = selected.length
      ? a.segments.filter((s) => selected.includes(s.id))
      : a.segments;
    download(
      `evidence-v${a.version}.txt`,
      [
        `${record.title}\nAssessment version ${a.version}; rubric ${a.rubricVersion}\nProvider: ${a.providerModel}\nApplicant statements are not independently verified.`,
        ...segments.map(
          (s) =>
            `\n[${s.id}] ${s.page ? `Page ${s.page}` : s.startSeconds != null ? `Audio ${time(s.startSeconds)}` : "Text"} | ${s.verified ? "Source checked by assessor" : "Needs source verification"}\nOriginal:\n${s.originalText}\nEnglish:\n${s.englishText}\nUsed by: ${
              a.fields
                .filter((f) => f.evidenceIds.includes(s.id))
                .map((f) => FIELD_LABELS[f.key])
                .join(", ") || "No extracted field"
            }`,
        ),
      ].join("\n"),
    );
  }
  const fileKind = active?.clarificationId
    ? active.startSeconds != null
      ? "audio"
      : "text"
    : record.inputType;
  function contents() {
    return (
      <>
        <div className="evidence-summary">
          <span>
            <strong>
              {a.segments.filter((s) => s.verified).length}/{a.segments.length}
            </strong>{" "}
            {t("source segments checked")}
          </span>
          <span>
            {t("Version")} {a.version} · {record.language}
          </span>
        </div>
        <div
          className="source-tabs"
          role="group"
          aria-label={t("Evidence display")}
        >
          {[
            ["compare", "Side by side"],
            ["translation", "English"],
            ["original", "Original language"],
            ...(!record.example && (record.fileName || active?.clarificationId)
              ? [["file", "Source file"]]
              : []),
            ...(record.inputType === "text" ? [["raw", "Submitted text"]] : []),
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={mode === key}
              className={mode === key ? "active" : ""}
              onClick={() => onModeChange(key!)}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <div className="evidence-toolbar">
          <label className="evidence-search">
            <Search size={14} />
            <input
              aria-label={t("Search source evidence")}
              placeholder={t("Search text, field or source ID")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label={t("Evidence verification filter")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{t("All verification states")}</option>
            <option value="unchecked">{t("Needs verification")}</option>
            <option value="checked">{t("Checked")}</option>
          </select>
          <label className="check-line">
            <input
              type="checkbox"
              disabled={!selected.length}
              checked={onlySelected && selected.length > 0}
              onChange={(e) => setOnlySelected(e.target.checked)}
            />
            {t("Selected sources only")}
          </label>
          {selected.length > 0 && (
            <button
              className="button text small"
              onClick={() => {
                onSelect([]);
                setOnlySelected(false);
                setConfirmed(false);
              }}
            >
              {t("Clear selection")}
            </button>
          )}
        </div>
        <div className="evidence-selection" aria-live="polite">
          <span>
            {selected.length ? `${selected.length} selected · ` : ""}
            {visible.length} / {a.segments.length} {t("shown")}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label={t("Previous source")}
              disabled={!active || a.segments.indexOf(active) === 0}
              onClick={() => {
                const i = a.segments.indexOf(active!);
                onSelect([a.segments[i - 1]!.id]);
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="icon-button"
              aria-label={t("Next source")}
              disabled={
                !active || a.segments.indexOf(active) >= a.segments.length - 1
              }
              onClick={() => {
                const i = a.segments.indexOf(active!);
                onSelect([a.segments[i + 1]!.id]);
              }}
            >
              <ChevronRight size={16} />
            </button>
            <button
              className="icon-button"
              aria-label={t("Download selected or all evidence")}
              onClick={exportEvidence}
            >
              <Download size={15} />
            </button>
          </div>
        </div>
        {mode === "raw" ? (
          <div className="raw-source">
            {record.originalText ??
              "No original text is stored for this format."}
          </div>
        ) : mode === "file" ? (
          <div className="original-file">
            {fileKind === "pdf" ? (
              <iframe
                key={`${url(active)}:${active?.page ?? 1}`}
                title={t("Original submitted PDF")}
                src={`${url(active)}#page=${active?.page ?? 1}`}
              />
            ) : fileKind === "audio" ? (
              <>
                <audio
                  ref={audio}
                  controls
                  onLoadedMetadata={seek}
                  src={url(active)}
                />
                {active?.startSeconds != null && (
                  <p>
                    {t("Selected passage:")} {time(active.startSeconds)}
                    {active.endSeconds != null
                      ? `–${time(active.endSeconds)}`
                      : ""}
                    {t(". Timing is approximate; compare with the recording.")}
                  </p>
                )}
              </>
            ) : (
              <pre className="raw-source">
                {active?.originalText ?? record.originalText}
              </pre>
            )}
            <a
              className="text-link"
              href={`${url(active)}${fileKind === "pdf" ? `#page=${active?.page ?? 1}` : ""}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("Open retained original")} <ExternalLink size={13} />
            </a>
          </div>
        ) : (
          <div className="source-segments" ref={list}>
            {visible.length === 0 && (
              <p className="evidence-empty">
                {t(
                  "No source segments match. Clear the search/filter or show all sources.",
                )}
              </p>
            )}
            {visible.map((s) => {
              const fields = a.fields.filter((f) =>
                  f.evidenceIds.includes(s.id),
                ),
                values = fields
                  .filter((f) => f.status === "supported")
                  .map((f) => f.value!)
                  .filter(Boolean);
              return (
                <article
                  id={`source-${s.id}`}
                  data-segment={s.id}
                  className={`source-segment ${selected.includes(s.id) ? "selected" : ""}`}
                  key={s.id}
                >
                  <div className="source-segment-meta">
                    <label className="check-line">
                      <input
                        type="checkbox"
                        aria-label={`Select source ${s.id}`}
                        checked={selected.includes(s.id)}
                        onChange={(e) =>
                          onSelect(
                            e.target.checked
                              ? [...selected, s.id]
                              : selected.filter((id) => id !== s.id),
                          )
                        }
                      />
                      <strong>{s.id}</strong>
                    </label>
                    <span className="status">
                      {s.verified
                        ? t("Source checked")
                        : t("Needs verification")}
                    </span>
                  </div>
                  <div className="source-location">
                    <span>
                      {s.page
                        ? `PAGE ${s.page}`
                        : s.startSeconds != null
                          ? `${time(s.startSeconds)}${s.endSeconds != null ? ` – ${time(s.endSeconds)}` : ""}`
                          : `${s.kind.toUpperCase()} SOURCE`}
                      {s.clarificationId ? t(" · CLARIFICATION") : ""}
                    </span>
                    {!record.example &&
                      (record.fileName || s.clarificationId) && (
                        <button
                          className="evidence-link"
                          onClick={() => locate(s)}
                        >
                          {s.startSeconds != null
                            ? t("Listen to passage")
                            : s.page
                              ? t("Open this page")
                              : t("Open original response")}{" "}
                          <ExternalLink size={11} />
                        </button>
                      )}
                  </div>
                  <div
                    className={`evidence-passages ${mode === "compare" ? "parallel" : ""}`}
                  >
                    {mode !== "translation" && (
                      <section>
                        <h4>
                          {t("Original ·")} {record.language}
                        </h4>
                        <p lang={record.language.split("-")[0]}>
                          <Highlight text={s.originalText} values={values} />
                        </p>
                      </section>
                    )}
                    {mode !== "original" && (
                      <section>
                        <h4>
                          {t("English")}{" "}
                          {s.verified
                            ? t("· checked")
                            : t("· AI output; verify")}
                        </h4>
                        <p lang="en">
                          <Highlight text={s.englishText} values={values} />
                        </p>
                      </section>
                    )}
                  </div>
                  <div className="evidence-field-links">
                    <span>{t("Used for")}</span>
                    {fields.length ? (
                      fields.map((f) => (
                        <span className="evidence-field-chip" key={f.key}>
                          {t(FIELD_LABELS[f.key])} · {f.status}
                        </span>
                      ))
                    ) : (
                      <span>{t("No extracted parameter")}</span>
                    )}
                  </div>
                  <button
                    className="evidence-link"
                    onClick={() =>
                      void navigator.clipboard
                        ?.writeText(`[${s.id}] ${s.englishText}`)
                        .then(() =>
                          setNotice("English quote and source ID copied."),
                        )
                        .catch(() =>
                          setNotice(
                            "Clipboard unavailable. Use the evidence download instead.",
                          ),
                        )
                    }
                  >
                    <Copy size={12} /> {t("Copy quote and reference")}
                  </button>
                </article>
              );
            })}
          </div>
        )}
        {notice && (
          <p role="status" className="hint evidence-copy-notice">
            {notice}
          </p>
        )}
        {!readOnly && !record.example && (
          <div className="source-verify">
            <label className="check-line">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={!selected.length || busy}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {t(
                "I compared the selected original passages with the transcript/translation.",
              )}
            </label>
            <button
              className="button secondary small"
              disabled={busy || !selected.length || !confirmed}
              onClick={onVerify}
            >
              <CheckCheck size={14} />
              {busy
                ? t("Saving verification…")
                : t("Confirm selected evidence")}
            </button>
            <p className="hint">
              {t(
                "This verifies source fidelity, not whether the applicant's business claims are true.",
              )}
            </p>
          </div>
        )}
      </>
    );
  }
  return (
    <section className="panel source-panel evidence-panel">
      <div className="panel-heading">
        <div>
          <h2>
            <FileText size={17} /> {t("Source evidence")}
          </h2>
          <p>{t("Trace each extracted fact back to its original.")}</p>
        </div>
        <button
          className="icon-button"
          aria-label={t("Expand evidence workspace")}
          onClick={() => setExpanded(true)}
        >
          <Maximize2 size={17} />
        </button>
      </div>
      {expanded ? (
        <p className="hint evidence-copy-notice">
          {t("Evidence is open in the expanded workspace.")}
        </p>
      ) : (
        contents()
      )}
      {expanded && (
        <Modal
          title={t("Source evidence workspace")}
          wide
          onClose={() => setExpanded(false)}
        >
          <div className="expanded-evidence evidence-panel">{contents()}</div>
        </Modal>
      )}
    </section>
  );
}
