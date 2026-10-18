// localized-ui
import HelpTip from "./HelpTip";
import { t, useLanguage } from "./i18n";
import { useEffect, useState } from "react";
import { ArrowRight, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import type { AssessorSupport, Submission } from "../../shared/types";
import { api } from "./api";
import { Notice } from "./components";

export default function AssessorInsights({
  record,
  onEvidence,
  onNearby,
}: {
  record: Submission;
  onEvidence: (ids: string[]) => void;
  onNearby: () => void;
}) {
  useLanguage();
  const [support, setSupport] = useState<AssessorSupport | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setSupport(null);
    setError("");
    if (record.example) return;
    api<{ support: AssessorSupport }>(
      `/submissions/${record.id}/decision-support`,
    )
      .then((r) => {
        if (!cancelled) {
          if (!r.support) throw new Error("Decision support is unavailable.");
          setSupport(r.support);
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Decision support is unavailable.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [record.id, record.assessment?.version, record.example, attempt]);
  const money = (value: number | null) =>
    value === null
      ? "Not available"
      : new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
        }).format(value);
  return (
    <section className="panel assessor-insights">
      <div className="panel-heading">
        <div>
          <h2>
            <ShieldCheck size={18} /> {t("Assessor decision support")}
          </h2>
          <p>
            {t(
              "Financial screening, evidence quality and checks for your review.",
            )}
          </p>
        </div>
      </div>
      {record.example ? (
        <div className="notes-body">
          <p>
            {t(
              "Live financial screening is available for assessed workspace submissions.",
            )}
          </p>
        </div>
      ) : error ? (
        <div className="notes-body">
          <Notice type="error">{error}</Notice>
          <button
            className="button secondary small"
            onClick={() => setAttempt((a) => a + 1)}
          >
            <RefreshCw size={14} />
            {t("Retry decision support")}
          </button>
        </div>
      ) : !support ? (
        <div className="notes-body" role="status">
          {t("Preparing assessor insights…")}
        </div>
      ) : (
        <>
          {support.screening && (
            <section className="screening-summary">
              <span className="eyebrow">
                {t("PROVISIONAL NEXT ACTION · ASSESSOR CONFIRMS")}
              </span>
              <h3>{t(support.screening.label)}</h3>
              <details className="screening-reasons">
                <summary>{t("Why this step?")}</summary>
                <p>
                  {t(
                    "Information readiness measures how well the idea is described. The concerns below assess the implications of the available statements.",
                  )}
                </p>
                <ul>
                  {support.screening.reasons.map((reason, index) => (
                    <li key={index}>
                      {reason.text}
                      {reason.evidenceIds.length > 0 && (
                        <button
                          className="evidence-link"
                          onClick={() => onEvidence(reason.evidenceIds)}
                        >
                          {t("Inspect reason sources")}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
              <details>
                <summary>
                  {t("Business potential: what is established?")}
                </summary>
                <div className="screening-domains">
                  {support.screening.domains.map((d) => (
                    <article key={d.key}>
                      <div>
                        <strong>{t(d.label)}</strong>
                        <span className="status">
                          {d.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p>{t(d.explanation)}</p>
                      {d.evidenceIds.length > 0 && (
                        <button
                          className="evidence-link"
                          onClick={() => onEvidence(d.evidenceIds)}
                        >
                          {t("View domain evidence")}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </details>
              <p className="hint">
                {t(
                  "This is screening guidance, not funding approval. Market potential and competitive advantage require assessor validation.",
                )}
              </p>
            </section>
          )}
          <div className="risk-summary">
            <div>
              <span className="eyebrow">{t("FINANCIAL RISK SCORE")}</span>
              <strong>
                {support.risk.score === null
                  ? t("Not assessable")
                  : `${support.risk.score} / 100`}
              </strong>
              <span>
                {support.risk.band.replaceAll("_", " ")} ·{" "}
                {support.risk.coverage}
                {t("% rule coverage")}
              </span>
            </div>
            <HelpTip label={t("FINANCIAL RISK SCORE")}>
              {t(support.risk.explanation)}
            </HelpTip>
          </div>
          <div className="support-metrics">
            {[
              [
                "Projected monthly surplus",
                money(support.financials.monthlySurplus),
              ],
              [
                "Projected operating margin",
                support.financials.marginPercent === null
                  ? "Not available"
                  : `${support.financials.marginPercent}%`,
              ],
              ["Funding-plan gap", money(support.financials.fundingPlanGap)],
              [
                "Stress-scenario monthly surplus",
                money(support.financials.stressedSurplus),
              ],
            ].map(([label, value]) => (
              <div key={t(label)}>
                <span>{t(label)}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="friendly-nearby-action">
            <button className="button secondary" onClick={onNearby}>
              {t("Find nearby similar businesses")}
              <ArrowRight size={15} />
            </button>
          </div>
          <details className="support-body friendly-assessor-details">
            <summary>{t("Checks for the assessor")}</summary>
            <div className="friendly-assessor-details-body">
              <p className="hint">
                {t(
                  "Surplus = stated monthly sales − stated monthly costs. It may exclude tax, owner pay and debt payments. Funding-plan gap = setup investment − own funds − requested external funding; requested funding is not secured funding.",
                )}
              </p>
              {support.financials.evidenceIds.length > 0 && (
                <button
                  className="evidence-link"
                  onClick={() => onEvidence(support.financials.evidenceIds)}
                >
                  {t("View financial source evidence")} <ArrowRight size={13} />
                </button>
              )}
              <h3>{t("What drives the risk score")}</h3>
              {support.risk.factors.map((f) => (
                <article className="risk-factor" key={f.key}>
                  <div>
                    <strong>{t(f.label)}</strong>
                    <span>
                      {f.points === null
                        ? t("Unknown")
                        : `${f.points} / 4 concern`}{" "}
                      · {f.weight}
                      {t("% weight")}
                    </span>
                  </div>
                  <p>{t(f.explanation)}</p>
                  {f.evidenceIds.length > 0 && (
                    <button
                      className="evidence-link"
                      onClick={() => onEvidence(f.evidenceIds)}
                    >
                      {t("View evidence")} <ArrowRight size={12} />
                    </button>
                  )}
                </article>
              ))}
              <h3>{t("Evidence quality")}</h3>
              <p>
                {support.evidence.supported} / {support.evidence.total}{" "}
                {t("parameters supported ·")} {support.evidence.conflicts}{" "}
                {t("conflicting parameters ·")}{" "}
                {support.evidence.verifiedSegments} /{" "}
                {support.evidence.totalSegments}{" "}
                {t(
                  "source segments reviewed. Source review does not independently verify business claims.",
                )}
              </p>
              <h3>{t("Checks for the assessor")}</h3>
              <ul className="assessor-checks">
                {support.followUps.map((item, i) => (
                  <li key={i}>
                    <strong>{t(item.title)}</strong>
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ul>

              <details className="risk-method">
                <summary>
                  {t("Method and limits ·")} {support.version}
                </summary>
                <p>
                  {t(
                    "Operating margin contributes 50%: nonpositive surplus = 4 concern points, positive margin below 10% = 3, below 20% = 2, otherwise 0. Stress contributes 25%: nonpositive scenario surplus = 4, surplus below 10% of original sales = 2, otherwise 0. Funding contributes 25%: positive gap = 4, over-allocation = 3, balanced = 0. Available points are normalized to 100; at least 50% coverage is required. Lower: 0–24; moderate: 25–59; higher: 60–100. These are product rules, not learned or calibrated failure estimates. No break-even units are calculated because fixed and per-unit variable costs are not separately collected.",
                  )}
                </p>
                <a
                  href="https://www.sba.gov/counseling/plan-your-business/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("SBA business planning reference")}{" "}
                  <ExternalLink size={12} />
                </a>
              </details>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
