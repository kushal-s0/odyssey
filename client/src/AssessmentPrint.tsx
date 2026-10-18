import { FIELD_LABELS, type Submission } from "../../shared/types";
import { questionText, t, useLanguage } from "./i18n";
export default function AssessmentPrint({ record }: { record: Submission }) {
  useLanguage();
  const a = record.assessment;
  if (!a) return null;
  return (
    <article className="assessment-print-report">
      <header>
        <h1>{record.title}</h1>
        <p>
          {record.beneficiaryName} · {a.language} · {t("Version")} {a.version}
        </p>
      </header>
      <h2>
        {t("Details score")}:{" "}
        {a.score == null ? t("Not enough details") : `${a.score} / 100`}
      </h2>
      <p>
        {t(
          "This score checks the details you shared, not business success. The current automatic score can reach 75 out of 100. Missing or conflicting answers can keep the score hidden.",
        )}
      </p>
      <h2>{t("The business, at a glance")}</h2>
      <table>
        <tbody>
          {a.fields.map((f) => (
            <tr key={f.key}>
              <th>{t(FIELD_LABELS[f.key])}</th>
              <td>{f.value ?? t("Not enough details")}</td>
              <td>
                {f.status}
                <br />
                {f.evidenceIds.join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>{t("Assessment dimensions")}</h2>
      {a.dimensions.map((d) => (
        <section key={d.key}>
          <h3>
            {t(d.label)} ·{" "}
            {d.score == null ? t("Not enough details") : `${d.score} / 4`}
          </h3>
          <p>{t(d.explanation)}</p>
          <small>{d.evidenceIds.join(", ")}</small>
        </section>
      ))}
      {a.questions.length > 0 && (
        <>
          <h2>{t("All questions")}</h2>
          <ol>
            {a.questions.map((q) => (
              <li key={q.id}>{questionText(q)}</li>
            ))}
          </ol>
        </>
      )}
      <h2>{t("Original sources")}</h2>
      {a.segments.map((s) => (
        <section className="print-source" key={s.id}>
          <h3>
            {s.id} ·{" "}
            {s.page
              ? `${t("Page")} ${s.page}`
              : s.startSeconds != null
                ? `${s.startSeconds}–${s.endSeconds}s`
                : t("Your text")}
          </h3>
          <strong>{t("Original")}</strong>
          <p>{s.originalText}</p>
          <strong>{t("English")}</strong>
          <p>{s.englishText}</p>
        </section>
      ))}
      {record.review && (
        <>
          <h2>{t("Assessor notes & next steps")}</h2>
          <p>{record.review.note}</p>
          <p>{record.review.nextAction}</p>
          {record.review.domainRatings?.map((r) => (
            <section key={r.key}>
              <h3>
                {r.key} · {r.score} / 4
              </h3>
              <p>{r.reason}</p>
              <small>{r.evidenceIds.join(", ")}</small>
            </section>
          ))}
        </>
      )}
      <h2>{t("What to keep in mind")}</h2>
      <ul>
        {a.warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
      <small>
        {a.providerModel} · {a.rubricVersion}
      </small>
    </article>
  );
}
