import ValueHelp, { DimensionHelp } from "./ValueHelp";
import type { Assessment } from "../../shared/types";
import { t, useLanguage } from "./i18n";

export default function ScoreExplanation({
  assessment: a,
  compact = false,
}: {
  assessment: Assessment;
  compact?: boolean;
}) {
  useLanguage();
  const dimensions = a.dimensions.filter((d) => d.weight > 0);
  const weighted = dimensions.reduce(
    (sum, d) => sum + ((d.score ?? 0) / 4) * d.weight,
    0,
  );
  const answered = a.fields.filter(
    (f) => f.status === "supported" && f.value,
  ).length;
  return (
    <details
      className={`score-explanation panel ${compact ? "compact" : ""}`}
      aria-label={t("Understand your score")}
    >
      <summary className="score-explanation-toggle">
        <span>{t("How this score works")}</span>
        <span aria-hidden="true">+</span>
      </summary>
      <div className="score-explanation-content">
        <div className="score-explanation-heading">
          <div>
            <span className="eyebrow">{t("UNDERSTAND YOUR SCORE")}</span>
            <h2>{t("What this number means")}</h2>
          </div>
          <ValueHelp topic="readiness">
            <span className="score-explanation-total">
              {a.score ?? "—"}
              <small>{t("out of 100")}</small>
            </span>
          </ValueHelp>
        </div>
        <p>
          {t(
            "This measures how much supporting information your idea contains. It is not a prediction of profit, loan approval, or business success.",
          )}
        </p>
        <div className="score-facts">
          <div>
            <ValueHelp topic="answered">
              <strong>
                {answered} / {a.fields.length}
              </strong>
            </ValueHelp>
            <span>{t("Parameters with source support")}</span>
          </div>
          <div>
            <ValueHelp topic="completeness">
              <strong>{a.completeness}%</strong>
            </ValueHelp>
            <span>{t("Core details supplied")}</span>
          </div>
          <div>
            <ValueHelp topic="coverage">
              <strong>{a.coverage}%</strong>
            </ValueHelp>
            <span>{t("Weight of assessable areas")}</span>
          </div>
        </div>
        {a.score === null && (
          <p className="notice">
            {t(
              "A score is withheld when coverage is below 70% or key answers conflict. Answer the outstanding questions to make the assessment possible.",
            )}
          </p>
        )}
        <details>
          <summary>{t("How the score is calculated")}</summary>
          <p>
            {t(
              "Assessable areas receive 1–3 points for available evidence on a 4-point scale. Complete supplied information earns 3; the automatic rubric does not award the fourth point for business quality. Its current maximum is 75/100.",
            )}
          </p>
          <div className="score-breakdown" role="list">
            {dimensions.map((d) => (
              <div className="score-breakdown-row" role="listitem" key={d.key}>
                <strong>{t(d.label)}</strong>
                <DimensionHelp
                  dimension={d.key}
                  label={d.label}
                  score={d.score}
                  weight={d.weight}
                >
                  <span>
                    {d.score === null ? t("Not assessable") : `${d.score} / 4`}
                  </span>
                </DimensionHelp>
                <ValueHelp topic="weight">
                  <span>
                    {t("Weight")} {d.weight}%
                  </span>
                </ValueHelp>
                <div className="score-area-track" aria-hidden="true">
                  <span style={{ width: `${(d.score ?? 0) * 25}%` }} />
                </div>
                <ValueHelp topic="points">
                  <small>
                    {d.score === null
                      ? t("No points included")
                      : t("{points} weighted points", {
                          points: ((d.score / 4) * d.weight).toFixed(2),
                        })}
                  </small>
                </ValueHelp>
              </div>
            ))}
          </div>
          <p className="score-formula">
            {t("Total")} ={" "}
            {a.coverage ? (
              <>
                {weighted.toFixed(2)} ÷ {a.coverage} × 100{" "}
                {a.score === null ? `(${t("withheld")})` : `≈ ${a.score}`}
              </>
            ) : (
              t("Not assessable")
            )}
          </p>
          <p>
            {t(
              "Missing areas stay unassessed. Their weights are excluded from the denominator. Completeness counts 14 core details; the question checklist covers all 19 parameters.",
            )}
          </p>
        </details>
        <p className="score-next">
          <strong>{t("Your next step")}: </strong>
          {a.questions.length
            ? t(
                "Answer the missing questions, resolve conflicting amounts, and ask your assessor to review the original sources.",
              )
            : t(
                "Your details are supplied. Ask your assessor to verify the sources and review business potential.",
              )}
        </p>
        <small>
          {t(
            "Financial risk and assessor business-potential ratings are separate from information readiness.",
          )}
        </small>
      </div>
    </details>
  );
}
