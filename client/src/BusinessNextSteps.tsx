import { useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  Check,
  ChevronDown,
  Compass,
} from "lucide-react";
import {
  BUSINESS_SUPPORT,
  entrepreneurSteps,
} from "../../shared/entrepreneur-guide";
import type { Submission, FieldKey } from "../../shared/types";
import { t, useLanguage } from "./i18n";
import HelpTip from "./HelpTip";
export default function BusinessNextSteps({
  record,
  onAnswer,
}: {
  record: Submission;
  onAnswer: (field?: FieldKey) => void;
}) {
  useLanguage();
  const [opened, setOpened] = useState<string | null>(null);
  const steps = entrepreneurSteps(record);
  return (
    <section className="business-next-steps" aria-label={t("Your next steps")}>
      <div className="friendly-section-heading">
        <div>
          <span className="eyebrow">{t("ONE STEP AT A TIME")}</span>
          <h2>{t("What can I do next?")}</h2>
        </div>
        <span className="friendly-section-note">
          {t("Based on the details you shared")}
        </span>
      </div>
      <div className="next-step-grid">
        {steps.map((step, index) => (
          <article className="next-step-card panel" key={step.key}>
            <div className="step-card-top">
              <span className="step-count">0{index + 1}</span>
              <HelpTip label={t("Why this step?")}>{t(step.why)}</HelpTip>
            </div>
            <span className="step-hint">{t(step.hint)}</span>
            <h3>{t(step.title)}</h3>
            <button
              type="button"
              className="step-open"
              aria-expanded={opened === step.key}
              onClick={() => setOpened(opened === step.key ? null : step.key)}
            >
              {t("Show me how")}
              <ChevronDown size={16} />
            </button>
            {opened === step.key && (
              <div className="step-instructions">
                <p>{t(step.why)}</p>
                {step.note && <blockquote>{step.note}</blockquote>}
                <ul>
                  {step.tasks.map((task) => (
                    <li key={task}>
                      <Check size={14} />
                      <span>{t(task)}</span>
                    </li>
                  ))}
                </ul>
                {step.field && (
                  <button
                    className="button primary small"
                    onClick={() => onAnswer(step.field)}
                  >
                    {t("Add this answer")}
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      <details className="support-explorer panel">
        <summary>
          <span>
            <Compass size={20} />
            <span>
              <strong>{t("Explore business support")}</strong>
              <small>{t("Registration and loan options")}</small>
            </span>
          </span>
          <ChevronDown size={19} />
        </summary>
        <div className="support-explorer-body">
          <p className="support-note">
            {t(
              "These are options to explore, not an eligibility check or a promise of funding.",
            )}
          </p>
          <div className="support-resource-grid">
            {BUSINESS_SUPPORT.map((item) => (
              <article key={item.key}>
                <span className="friendly-badge">{t(item.type)}</span>
                <h3>{item.name}</h3>
                <strong>{t(item.title)}</strong>
                <p>{t(item.help)}</p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link"
                >
                  {t("Open official website")}
                  <ExternalLink size={14} />
                </a>
                {"source" in item && (
                  <a
                    href={item.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="support-source"
                  >
                    {t("Government source")}
                  </a>
                )}
              </article>
            ))}
          </div>
          <small>
            {t(
              "Sources checked: 18 Oct 2026. Check current rules on the official website before applying.",
            )}
          </small>
        </div>
      </details>
    </section>
  );
}
