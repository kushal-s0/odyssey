import { useState } from "react";
import {
  Check,
  Circle,
  Lightbulb,
  Users,
  Wallet,
  Store,
  ArrowRight,
  FileText,
} from "lucide-react";
import type { Submission, FieldKey } from "../../shared/types";
import { FIELD_LABELS } from "../../shared/types";
import { IDEA_AREAS } from "../../shared/entrepreneur-guide";
import { t, useLanguage } from "./i18n";
import { Modal } from "./components";
import HelpTip from "./HelpTip";
import ScoreExplanation from "./ScoreExplanation";
const icons = [Lightbulb, Users, Wallet, Store];
export default function IdeaVisualizer({
  record,
  onAnswer,
  onDetails,
}: {
  record: Submission;
  onAnswer: (field?: FieldKey) => void;
  onDetails: () => void;
}) {
  useLanguage();
  const [area, setArea] = useState<string | null>(null);
  const a = record.assessment!;
  const current = IDEA_AREAS.find((v) => v.key === area);
  const answered = (fields: readonly FieldKey[]) =>
    fields.filter((key) =>
      a.fields.some(
        (f) => f.key === key && f.status === "supported" && !!f.value,
      ),
    ).length;
  return (
    <section
      className="idea-visualizer panel"
      aria-label={t("Your idea at a glance")}
    >
      <div className="visualizer-heading">
        <div>
          <span className="eyebrow">{t("YOUR NEXT CHAPTER")}</span>
          <h2>{t("Your idea at a glance")}</h2>
        </div>
        <span className="friendly-badge">
          {a.questions.length
            ? t("{count} answers to add", { count: a.questions.length })
            : t("Ready for review")}
        </span>
      </div>
      <div className="visualizer-body">
        <div className="idea-score-visual">
          <div className="score-orbit">
            <svg
              viewBox="0 0 180 180"
              role="img"
              aria-label={
                a.score == null
                  ? t("Not enough details")
                  : t("Details score: {score} out of 100", { score: a.score })
              }
            >
              <circle className="orbit-track" cx="90" cy="90" r="76" />
              <circle
                className="orbit-value"
                cx="90"
                cy="90"
                r="76"
                pathLength="100"
                strokeDasharray={`${Math.max(0, Math.min(100, a.score ?? 0))} 100`}
                transform="rotate(-90 90 90)"
              />
            </svg>
            <div>
              <strong>{a.score ?? "--"}</strong>
              <span>
                {a.score == null ? t("More detail needed") : t("out of 100")}
              </span>
            </div>
          </div>
          <div className="friendly-label">
            {t("Details score")}
            <HelpTip label={t("Details score")}>
              {t(
                "This score checks the details you shared, not business success. The current automatic score can reach 75 out of 100. Missing or conflicting answers can keep the score hidden.",
              )}
            </HelpTip>
          </div>
          <p className="visualizer-caption">
            {t("Your details, not your chance of success.")}
          </p>
        </div>
        <div className="idea-area-grid">
          {IDEA_AREAS.map((item, index) => {
            const Icon = icons[index]!,
              count = answered(item.fields);
            return (
              <article className="idea-area" key={item.key}>
                <div className="area-top">
                  <span className="area-icon">
                    <Icon size={21} />
                  </span>
                  <HelpTip label={t(item.label)}>{t(item.help)}</HelpTip>
                </div>
                <button
                  className="area-open"
                  type="button"
                  onClick={() => setArea(item.key)}
                  aria-label={t("Open {topic}", { topic: t(item.label) })}
                >
                  <strong>{t(item.label)}</strong>
                  <span>
                    {count}
                    <small> / {item.fields.length}</small>
                    <ArrowRight size={15} />
                  </span>
                </button>
                <div className="area-dots" aria-hidden="true">
                  {item.fields.map((key) => (
                    <i
                      key={key}
                      className={
                        a.fields.some(
                          (f) =>
                            f.key === key &&
                            f.status === "supported" &&
                            f.value,
                        )
                          ? "done"
                          : ""
                      }
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <div className="visualizer-footer">
        <span>
          <Check size={15} />
          {t("Each dot is one business detail.")}
        </span>
        <div>
          <button
            type="button"
            className="button secondary small"
            onClick={onDetails}
          >
            <FileText size={14} />
            {t("See my answers")}
          </button>
          {a.questions.length > 0 && (
            <button
              type="button"
              className="button primary small"
              onClick={() => onAnswer()}
            >
              {t("Add an answer")}
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
      <ScoreExplanation assessment={a} compact />
      {current && (
        <Modal title={t(current.label)} onClose={() => setArea(null)}>
          <p className="friendly-modal-intro">{t(current.help)}</p>
          <ul className="area-detail-list">
            {current.fields.map((key) => {
              const field = a.fields.find((f) => f.key === key),
                found = field?.status === "supported" && !!field.value;
              return (
                <li key={key}>
                  <span
                    className={
                      found ? "area-detail-check found" : "area-detail-check"
                    }
                  >
                    {found ? <Check size={17} /> : <Circle size={17} />}
                  </span>
                  <div>
                    <strong>{t(FIELD_LABELS[key])}</strong>
                    <p>
                      {found
                        ? field.value
                        : t(
                            field?.status === "ambiguous"
                              ? "This answer needs a check."
                              : "You can add this detail.",
                          )}
                    </p>
                  </div>
                  {!found && a.questions.some((q) => q.field === key) && (
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => {
                        setArea(null);
                        onAnswer(key);
                      }}
                    >
                      {t("Answer")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Modal>
      )}
    </section>
  );
}
