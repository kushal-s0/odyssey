import { type ReactNode } from "react";
import {
  SCORE_HELP,
  DIMENSION_HELP,
  AUTOMATIC_SCALE,
  REVIEWER_SCALE,
  type HelpTopic,
} from "../../shared/score-help";
import { t, useLanguage } from "./i18n";
import HelpTip from "./HelpTip";
export default function ValueHelp({
  topic,
  children,
}: {
  topic: HelpTopic;
  children?: ReactNode;
}) {
  useLanguage();
  const help = SCORE_HELP[topic];
  return (
    <HelpTip label={t(help.title)} trigger={children}>
      {t(help.text)}
    </HelpTip>
  );
}
export function DimensionHelp({
  dimension,
  label,
  score,
  weight,
  human = false,
  children,
}: {
  dimension: string;
  label: string;
  score: number | null;
  weight?: number;
  human?: boolean;
  children?: ReactNode;
}) {
  useLanguage();
  return (
    <HelpTip label={t(label)} trigger={children}>
      <span className="help-paragraph">
        {t(DIMENSION_HELP[dimension] ?? SCORE_HELP.readiness.text)}
      </span>
      <span className="help-paragraph">
        {t("Current value: {value}", {
          value: score === null ? t("Not enough details") : `${score} / 4`,
        })}
      </span>
      <span className="help-paragraph">
        {t(
          dimension === "completeness"
            ? SCORE_HELP.completeness.text
            : human
              ? REVIEWER_SCALE
              : AUTOMATIC_SCALE,
        )}
      </span>
      {weight !== undefined && weight > 0 && (
        <span className="help-paragraph">
          {t("Share of the total: {value}%", { value: weight })}
        </span>
      )}
    </HelpTip>
  );
}
