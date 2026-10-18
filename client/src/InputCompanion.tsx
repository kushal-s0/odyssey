// localized-ui
import ValueHelp from "./ValueHelp";
import { t, useLanguage } from "./i18n";
import { Check, CircleHelp, ArrowDown, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { inputAssistance } from "../../shared/input-assistance";
import type { GuidedDraft } from "./GuidedIdeaInputs";
import { Progress } from "./components";

export default function InputCompanion({
  value,
  onPreview,
}: {
  value: GuidedDraft;
  onPreview: () => void;
}) {
  useLanguage();
  const status = inputAssistance(value);
  const [expanded, setExpanded] = useState(
    () => window.matchMedia("(min-width: 1051px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1051px)");
    const update = (event: MediaQueryListEvent) => setExpanded(event.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const money = (amount: number | null) =>
    amount === null
      ? "Not enough information"
      : new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 2,
        }).format(amount);
  return (
    <section
      className="input-companion"
      aria-label={t("Submission preparation")}
    >
      <span className="eyebrow">{t("YOUR SUBMISSION")}</span>
      <h2>{t("A clear starting point.")}</h2>
      <div className="preparation-count">
        <ValueHelp topic="form">
          <strong>
            {status.entered}
            <span> / {status.total}</span>
          </strong>
        </ValueHelp>
        <span>{t("guided details entered")}</span>
      </div>
      <Progress value={(status.entered / status.total) * 100} />
      <p className="hint">
        {t(
          "This tracks form entries, not your assessment score. Optional answers can stay unknown.",
        )}
      </p>
      <details
        className="preparation-tools"
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary>
          {t("Preparation tools")}{" "}
          <span>{t("Sections, calculations & preview")}</span>
        </summary>
        <nav
          className="input-section-nav"
          aria-label={t("Guided form sections")}
        >
          {[
            ["business", "Business & customers"],
            ["operations", "Operations & experience"],
            ["finances", "Financial assumptions"],
            ["research", "Market research"],
          ].map(([key, label], i) => (
            <a href={`#guided-section-${key}`} key={key}>
              <span>0{i + 1}</span>
              {t(label)}
              <ArrowDown size={13} />
            </a>
          ))}
        </nav>
        <div className="draft-financials">
          <h3>
            <Wallet size={16} /> {t("Your financial assumptions")}
          </h3>
          <div>
            <span>{t("Projected monthly surplus")}</span>
            <ValueHelp topic="surplus">
              <strong>{t(money(status.surplus))}</strong>
            </ValueHelp>
          </div>
          <div>
            <span>{t("Funding-plan gap")}</span>
            <ValueHelp topic="fundingGap">
              <strong>{t(money(status.fundingGap))}</strong>
            </ValueHelp>
          </div>
          <p>
            {t(
              "Calculated from your entries. Surplus = monthly sales − monthly costs. Funding gap = setup investment − own funds − requested external funds.",
            )}
          </p>
        </div>
        <div className="preparation-note">
          {status.valid ? (
            <>
              <Check size={16} />
              <span>
                {t(
                  "Guided answers pass the input checks. Review them before submitting.",
                )}
              </span>
            </>
          ) : (
            <>
              <CircleHelp size={16} />
              <span>
                {status.entered === 0
                  ? t(
                      "Start with your products and services. Other details can wait.",
                    )
                  : t(
                      status.issues[0] ??
                        "Add the required business description.",
                    )}
              </span>
            </>
          )}
        </div>
        <button
          className="button secondary full-width"
          type="button"
          onClick={onPreview}
        >
          {t("Preview standardized input")}
        </button>
      </details>
    </section>
  );
}
