// localized-ui
import ReadMore from "../ReadMore";
import { t, useLanguage } from "../i18n";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  FlaskConical,
  Layers,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { PageIntro, Notice, Empty } from "../components";
import { useWorkspace } from "../workspace";
import { api, download } from "../api";
import { FIELD_LABELS } from "../../../shared/types";
import { trainingReadiness } from "../../../shared/training";
export default function ModelLab() {
  useLanguage();
  const w = useWorkspace();
  const [annotations, setAnnotations] = useState<any[]>([]),
    [remoteModel, setRemoteModel] = useState<any>(null),
    [submissionId, setSubmissionId] = useState(""),
    [field, setField] = useState(""),
    [groupId, setGroupId] = useState(""),
    [label, setLabel] = useState(0),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const live = w.mode === "live" && !!w.session?.user;
  const submission = w.submissions.find((s) => s.id === submissionId);
  const fields =
    submission?.assessment?.fields.filter((f) => f.evidenceIds.length) ?? [];
  const selected = fields.find((f) => f.key === field);
  const answer =
    selected?.value ??
    selected?.evidenceIds
      .map(
        (id) =>
          submission?.assessment?.segments.find((s) => s.id === id)
            ?.englishText,
      )
      .join(" ");
  const load = () =>
    api<{ annotations: any[] }>("/training/annotations").then((r) =>
      setAnnotations(r.annotations),
    );
  useEffect(() => {
    if (live) {
      void load().catch(() => {});
      void api("/training/model")
        .then(setRemoteModel)
        .catch(() => setRemoteModel(null));
    } else {
      setAnnotations([]);
      setRemoteModel(null);
    }
  }, [live]);
  const readiness = trainingReadiness(annotations);
  const modelAssessments = w.submissions
    .map((s) => s.assessment)
    .filter((a) => a?.classifier.status === "available");
  function exportAnnotations() {
    download(
      "reviewed-answers.jsonl",
      annotations
        .map((a) =>
          JSON.stringify({
            id: a.id,
            submissionId: a.submissionId,
            field: a.field,
            businessContext: a.businessContext,
            question: a.question,
            answer: a.answer,
            label: a.label,
            groupId: a.groupId,
            language: a.language,
          }),
        )
        .join("\n"),
      "application/x-ndjson",
    );
  }
  return (
    <>
      <PageIntro
        eyebrow={t("A SMALL MODEL WITH A CLEAR JOB")}
        title={t("Train for better input quality.")}
        description={t(
          "Review answer relevance, preserve independent business groups, and evaluate honestly.",
        )}
        action={
          <button
            className="button secondary"
            onClick={exportAnnotations}
            disabled={!annotations.length}
          >
            <ArrowDownToLine size={15} />
            {t("Export reviewed answers")}
          </button>
        }
      />
      <div className="model-banner">
        <div className="model-banner-icon">
          <FlaskConical size={28} />
        </div>
        <div>
          <span className="eyebrow">
            {t("CLOUD-TRAINED RESPONSE RELEVANCE")}
          </span>
          <h2>{t("Does this answer address the question?")}</h2>
          <ReadMore title="How it works">
            {" "}
            <p>
              {t(
                "A supervised classifier flags potentially off-topic responses for review. Business outcomes and funding decisions remain outside its scope.",
              )}
            </p>
          </ReadMore>
        </div>
        <span className="outline-label">
          {remoteModel?.ready
            ? t("Cloud artefact loaded")
            : modelAssessments.length
              ? t("Endpoint used in assessments")
              : t("Training not verified")}
        </span>
      </div>
      <div className="model-stats">
        {readiness.checks.map((check) => (
          <div key={check.label}>
            <strong>
              {check.current} / {check.required}
            </strong>
            <span>{check.label}</span>
          </div>
        ))}
      </div>
      {live && (
        <Notice>
          {readiness.ready
            ? t(
                "These saved labels meet the minimum count checks. Verify business families and inspect grouped evaluation in Colab before using the model.",
              )
            : `These saved labels are not ready for training. Still needed: ${readiness.checks
                .filter((check) => check.remaining > 0)
                .map((check) => `${check.remaining} ${check.label}`)
                .join(
                  ", ",
                )}. Exports from this screen contain only labels saved here.`}{" "}
          {t(
            "Keep translations and revisions of the same business in one family.",
          )}
        </Notice>
      )}
      {remoteModel?.ready && remoteModel.metrics && (
        <section className="panel model-evaluation">
          <div className="panel-heading">
            <div>
              <h2>{t("Measured cloud-training results")}</h2>
              <p>
                {remoteModel.modelVersion} · {remoteModel.metrics.evaluation}
              </p>
            </div>
            <span className="outline-label">
              {t("EXPERIMENTAL · ADVISORY")}
            </span>
          </div>
          <div className="model-stats">
            {[
              ["Macro-F1", remoteModel.metrics.macroF1],
              ["Off-topic recall", remoteModel.metrics.offTopicRecall],
              ["Evaluation coverage", remoteModel.metrics.evaluationCoverage],
              ["Abstention rate", remoteModel.metrics.abstentionRate],
            ].map(([label, value]) => (
              <div key={t(label)}>
                <strong>
                  {typeof value === "number"
                    ? `${Math.round(value * 100)}%`
                    : "—"}
                </strong>
                <span>{t(label)}</span>
              </div>
            ))}
          </div>
          <div className="panel-footer">
            {remoteModel.metrics.rows} {t("reviewed answers ·")}{" "}
            {remoteModel.metrics.groups}{" "}
            {t(
              "groups. Small-data grouped evaluation does not establish general accuracy.",
            )}
          </div>
        </section>
      )}
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{t("Review an answer")}</h2>
              <p>
                {t(
                  "Label the answer itself, rather than relying on its filename.",
                )}
              </p>
            </div>
          </div>
          <form
            className="settings-body annotation-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError("");
              try {
                await api("/training/annotations", {
                  method: "POST",
                  body: JSON.stringify({ submissionId, field, label, groupId }),
                });
                await load();
                w.notify(
                  "Reviewed label saved. Keep related translations and revisions in the same group.",
                );
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not save annotation.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {!live && (
              <Notice>
                {t(
                  "Annotation requires a connected live workspace and actual processed submissions. Synthetic interface examples are excluded from training.",
                )}
              </Notice>
            )}
            <label>
              {t("Submission")}
              <select
                value={submissionId}
                onChange={(e) => {
                  setSubmissionId(e.target.value);
                  setField("");
                }}
                required
              >
                <option value="">{t("Select an assessed submission")}</option>
                {w.submissions
                  .filter((s) => s.assessment)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t("Question / field")}
              <select
                value={field}
                onChange={(e) => setField(e.target.value)}
                required
              >
                <option value="">
                  {t("Select an answer with source evidence")}
                </option>
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {t(FIELD_LABELS[f.key])}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <div className="question-card">
                <div className="eyebrow">{t("ANSWER TO REVIEW")}</div>
                <p>{answer}</p>
                <small>
                  {t("Question:")} {t(FIELD_LABELS[selected.key])}
                </small>
              </div>
            )}
            <label>
              {t("Underlying business / scenario family")}
              <input
                required
                minLength={2}
                maxLength={100}
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                placeholder={t("e.g. tailoring-family-01")}
              />
              <small className="hint">
                {t(
                  "Use the same group for all related translations, revisions, and scenario variants.",
                )}
              </small>
            </label>
            <div className="annotation-options">
              <label>
                <input
                  type="radio"
                  name="relevance"
                  checked={label === 0}
                  onChange={() => setLabel(0)}
                />
                {t("Relevant answer")}
              </label>
              <label>
                <input
                  type="radio"
                  name="relevance"
                  checked={label === 1}
                  onChange={() => setLabel(1)}
                />
                {t("Off-topic answer")}
              </label>
            </div>
            {error && <Notice type="error">{error}</Notice>}
            <button
              className="button primary"
              disabled={!live || pending || !selected}
            >
              {pending ? (
                <Loader2 size={15} className="spin" />
              ) : (
                <Check size={15} />
              )}
              {t("Save reviewed label")}
            </button>
          </form>
        </section>
        <details className="panel friendly-detail-group">
          <summary>{t("Cloud training workflow")}</summary>
          <div className="panel-heading">
            <div>
              <h2>{t("Cloud training workflow")}</h2>
              <p>
                {t("No training or model inference runs on this computer.")}
              </p>
            </div>
            <Layers size={19} />
          </div>
          <div className="settings-body">
            <ol className="process-list">
              <li>
                <span>1</span>
                <div>
                  <strong>{t("Review evidence and labels")}</strong>
                  <p>
                    {t(
                      "Correct transcripts before labelling. Keep examples from the same business together.",
                    )}
                  </p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>{t("Run the supplied Colab notebook")}</strong>
                  <p>
                    {t(
                      "Upload reviewed answers, generate hosted embeddings, and train a regularized classifier in the cloud.",
                    )}
                  </p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>{t("Measure grouped performance")}</strong>
                  <p>
                    {t(
                      "Inspect macro-F1, off-topic recall, confusion matrices, and group counts. No metrics are shown until a real training run exists.",
                    )}
                  </p>
                </div>
              </li>
              <li>
                <span>4</span>
                <div>
                  <strong>{t("Deploy the remote model service")}</strong>
                  <p>
                    {t(
                      "Load the exported artefact into the separate hosted service and configure its URL and service token.",
                    )}
                  </p>
                </div>
              </li>
            </ol>
            <div className="aside-note">
              <ShieldCheck size={19} />
              <p>
                {t(
                  "Predictions are advisory model scores. They are not calibrated probabilities of truth and cannot fill missing facts.",
                )}
              </p>
            </div>
            <p className="hint">
              {t("Notebook: training/cloud_training.ipynb")}
              <br />
              {t("Service: model-service/")}
              <br />
              {t("Instructions: README.md")}
            </p>
          </div>
        </details>
      </div>
    </>
  );
}
