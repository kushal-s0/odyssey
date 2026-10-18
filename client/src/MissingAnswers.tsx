import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeft, ListChecks, FileText } from "lucide-react";
import {
  FIELD_LABELS,
  type Assessment,
  type FieldKey,
} from "../../shared/types";
import { PARAMETER_QUESTIONS } from "../../shared/repair-questions";
import { questionText, t, useLanguage } from "./i18n";
import HelpTip from "./HelpTip";
export default function MissingAnswers({
  assessment: a,
  onAnswer,
  onBrowse,
  onSources,
}: {
  assessment: Assessment;
  onAnswer: (field: FieldKey) => void;
  onBrowse: () => void;
  onSources: () => void;
}) {
  useLanguage();
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [a.version]);
  const q = a.questions[Math.min(index, a.questions.length - 1)];
  return (
    <section className="panel one-question-panel" aria-label={t("Add answers")}>
      <div className="one-question-heading">
        <div>
          <span className="eyebrow">{t("ONE STEP AT A TIME")}</span>
          <h2>{t(q ? "Add one answer" : "Ready for review")}</h2>
        </div>
        <span className="friendly-badge">
          {t("{count} left", { count: a.questions.length })}
        </span>
      </div>
      {q ? (
        <>
          <div className="one-question-body">
            <div className="friendly-label">
              <span>{t(FIELD_LABELS[q.field])}</span>
              <HelpTip label={t("Answer guidance")}>
                {t(PARAMETER_QUESTIONS[q.field].hint)}
              </HelpTip>
            </div>
            <h3>{questionText(q)}</h3>
            <button
              className="button primary"
              onClick={() => onAnswer(q.field)}
            >
              {t("Answer")}
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="one-question-nav">
            <button
              className="icon-button"
              aria-label={t("Previous question")}
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
            >
              <ArrowLeft size={17} />
            </button>
            <span>
              {Math.min(index + 1, a.questions.length)} / {a.questions.length}
            </span>
            <button
              className="icon-button"
              aria-label={t("Next question")}
              disabled={index >= a.questions.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              <ArrowRight size={17} />
            </button>
          </div>
        </>
      ) : (
        <p className="friendly-complete">
          {t("All details are added. A reviewer can check your idea.")}
        </p>
      )}
      <div className="one-question-footer">
        <button className="text-link" onClick={onBrowse}>
          <ListChecks size={15} />
          {t("All questions")}
        </button>
        <button className="text-link" onClick={onSources}>
          <FileText size={15} />
          {t("Original sources")}
        </button>
      </div>
    </section>
  );
}
