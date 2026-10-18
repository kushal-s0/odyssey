// localized-ui
import { t, useLanguage } from "../i18n";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, SlidersHorizontal, ArrowDownToLine } from "lucide-react";
import { PageIntro, SubmissionsTable } from "../components";
import { useWorkspace } from "../workspace";
export default function Submissions() {
  useLanguage();
  const w = useWorkspace();
  const entrepreneur = w.session?.user?.role === "entrepreneur";
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [format, setFormat] = useState(""),
    [cohort, setCohort] = useState("");
  const items = w.submissions.filter(
    (s) =>
      (!query ||
        `${s.title} ${s.beneficiaryName} ${s.language}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!status || s.status === status) &&
      (!format || s.inputType === format) &&
      (!cohort || s.cohortId === cohort),
  );
  return (
    <>
      <PageIntro
        eyebrow={t("ONE PLACE FOR EVERY PROPOSAL")}
        title={entrepreneur ? t("My submissions") : t("All submissions")}
        description={
          entrepreneur
            ? t("Track your ideas, assessments, and next steps.")
            : t(
                "Review ideas across formats, languages, and programme cohorts.",
              )
        }
        action={
          <Link to="/submit" className="button primary">
            <Plus size={16} />
            {t("Submit an idea")}
          </Link>
        }
      />
      <section className="panel">
        <div className="filter-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label={t("Search submissions")}
              placeholder={t("Search ideas, beneficiaries, languages…")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label={t("Status filter")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{t("All statuses")}</option>
            <option value="ready">{t("Ready for review")}</option>
            <option value="needs_review">{t("Needs review")}</option>
            <option value="processing">{t("Processing")}</option>
            <option value="queued">{t("In queue")}</option>
            <option value="failed">{t("Needs attention")}</option>
          </select>
          <select
            aria-label={t("Format filter")}
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="">{t("All formats")}</option>
            <option value="text">{t("Text")}</option>
            <option value="pdf">{t("PDF")}</option>
            <option value="audio">{t("Audio")}</option>
          </select>
          {!entrepreneur && (
            <select
              aria-label={t("Cohort filter")}
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
            >
              <option value="">{t("All cohorts")}</option>
              {w.cohorts.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="results-caption">
          <span>
            {items.length}{" "}
            {items.length === 1 ? t("submission") : t("submissions")}
          </span>
          {(query || status || format || cohort) && (
            <button
              className="text-button"
              onClick={() => {
                setQuery("");
                setStatus("");
                setFormat("");
                setCohort("");
              }}
            >
              {t("Clear filters")}
            </button>
          )}
          <span>
            {w.mode === "examples"
              ? t("Read-only examples")
              : t("Latest 500 records")}
          </span>
        </div>
        <SubmissionsTable items={items} personal={entrepreneur} />
      </section>
    </>
  );
}
