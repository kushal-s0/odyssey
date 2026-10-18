// localized-ui
import { t, useLanguage } from "./i18n";
import {
  BUSINESS_DOMAINS,
  reviewedPotential,
  type DomainRating,
} from "../../shared/business-review";
import type { Submission } from "../../shared/types";
export function PotentialReviewFields({
  record,
  ratings,
  onChange,
  disabled,
}: {
  record: Submission;
  ratings: DomainRating[];
  onChange: (ratings: DomainRating[]) => void;
  disabled: boolean;
}) {
  useLanguage();
  function update(key: DomainRating["key"], patch: Partial<DomainRating>) {
    const old = ratings.find((r) => r.key === key) ?? {
      key,
      score: 2,
      reason: "",
      evidenceIds: [],
    };
    onChange([...ratings.filter((r) => r.key !== key), { ...old, ...patch }]);
  }
  return (
    <details className="potential-review-fields">
      <summary>{t("Rate business potential across six domains")}</summary>
      <p className="hint">
        {t(
          "Your judgement is separate from information readiness and financial risk. Leave a domain unrated if evidence is insufficient. Cite passages and explain the rating; this is not a predicted success probability.",
        )}
      </p>
      <p className="hint">
        {t(
          "Anchors: 0 major concern · 1 weak case · 2 plausible · 3 promising · 4 strong case. Unrated means unknown.",
        )}
      </p>
      {BUSINESS_DOMAINS.map((d) => {
        const rating = ratings.find((r) => r.key === d.key);
        return (
          <fieldset key={d.key}>
            <legend>{t(d.label)}</legend>
            <p className="hint">{d.prompt}</p>
            <label>
              {t(d.label)} {t("rating")}
              <select
                aria-label={`${t(d.label)} rating`}
                disabled={disabled}
                value={rating ? String(rating.score) : ""}
                onChange={(e) => {
                  if (e.target.value === "")
                    onChange(ratings.filter((r) => r.key !== d.key));
                  else update(d.key, { score: Number(e.target.value) });
                }}
              >
                <option value="">
                  {t("Not rated / insufficient evidence")}
                </option>
                {[
                  "0 · Major concern",
                  "1 · Weak case",
                  "2 · Plausible",
                  "3 · Promising",
                  "4 · Strong case",
                ].map((label, i) => (
                  <option key={i} value={i}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            {rating && (
              <>
                <label>
                  {t(d.label)} {t("rationale")}
                  <textarea
                    minLength={20}
                    maxLength={600}
                    required
                    disabled={disabled}
                    value={rating.reason}
                    onChange={(e) => update(d.key, { reason: e.target.value })}
                  />
                </label>
                <label>
                  {t(d.label)} {t("evidence")}
                  <select
                    aria-label={`${t(d.label)} evidence`}
                    multiple
                    required
                    disabled={disabled}
                    value={rating.evidenceIds}
                    onChange={(e) =>
                      update(d.key, {
                        evidenceIds: Array.from(
                          e.target.selectedOptions,
                          (o) => o.value,
                        ),
                      })
                    }
                  >
                    {record.assessment!.segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id} · {s.englishText.slice(0, 90)}
                      </option>
                    ))}
                  </select>
                  <small>
                    {t("Choose one or more current source passages.")}
                  </small>
                </label>
              </>
            )}
          </fieldset>
        );
      })}
    </details>
  );
}
export function PotentialReviewResult({
  record,
  onEvidence,
}: {
  record: Submission;
  onEvidence: (ids: string[]) => void;
}) {
  useLanguage();
  const summary = reviewedPotential(record);
  return (
    <section className="panel potential-review-result">
      <div className="panel-heading">
        <div>
          <h2>{t("Assessor-rated business potential")}</h2>
          <p>
            {t(
              "Human judgement with reasons and citations; separate from information readiness.",
            )}
          </p>
        </div>
        <strong>
          {summary.score === null
            ? t("Not fully rated")
            : `${summary.score} / 100`}
        </strong>
      </div>
      {!summary.ratings.length ? (
        <p className="notes-body">
          {t(
            "No current domain ratings. Market and business quality remain unvalidated. An assessor can rate them when recording a review.",
          )}
        </p>
      ) : (
        <div className="screening-domains">
          {summary.ratings.map((r) => (
            <article key={r.key}>
              <div>
                <strong>{t(r.label)}</strong>
                <span>{r.score} / 4</span>
              </div>
              <p>{r.reason}</p>
              <button
                className="evidence-link"
                onClick={() => onEvidence(r.evidenceIds)}
              >
                {t("Inspect rating sources")}
              </button>
            </article>
          ))}
        </div>
      )}
      <p className="hint notes-body">
        {summary.ratings.length}{" "}
        {t(
          "of 6 domains rated. An aggregate is shown only when all six have current ratings. This is a screening opinion, not funding approval or a calibrated outcome prediction.",
        )}
      </p>
    </section>
  );
}
