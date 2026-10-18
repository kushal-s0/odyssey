// localized-ui
import { questionText, t, useLanguage } from "../i18n";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  FileText,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  History,
  Info,
  Loader2,
  MessageSquare,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Mic,
  AlignLeft,
  Download,
  Search,
} from "lucide-react";
import {
  FIELD_LABELS,
  FIELD_KEYS,
  LANGUAGES,
  type Submission,
  type Assessment,
  type RepairQuestion,
  type SimilarIdea,
  type EvidenceField,
  type FieldKey,
} from "../../../shared/types";
import { PARAMETER_QUESTIONS } from "../../../shared/repair-questions";
import { useWorkspace } from "../workspace";
import { api, download } from "../api";
import {
  preparationChecklist,
  QUESTION_GROUPS,
} from "../../../shared/input-assistance";
import AssessorInsights from "../AssessorInsights";
import LocationPanel from "../LocationPanel";
import EvidencePanel from "../EvidencePanel";
import { flushSync } from "react-dom";
import ValueHelp, { DimensionHelp } from "../ValueHelp";
import AssessmentPrint from "../AssessmentPrint";
import MissingAnswers from "../MissingAnswers";
import ScoreExplanation from "../ScoreExplanation";
import IdeaVisualizer from "../IdeaVisualizer";
import BusinessNextSteps from "../BusinessNextSteps";
import CohortAssignment from "../CohortAssignment";
import {
  PotentialReviewFields,
  PotentialReviewResult,
} from "../PotentialReview";
import type { DomainRating } from "../../../shared/business-review";
import {
  assessorReviewSchema,
  REVIEW_REASONS,
} from "../../../shared/input-rules";
import {
  Busy,
  Empty,
  FieldCard,
  Icon,
  Modal,
  Notice,
  PageIntro,
  Progress,
  Recorder,
  Status,
} from "../components";
export default function Detail() {
  useLanguage();
  const { id } = useParams();
  const [search] = useSearchParams();
  const w = useWorkspace();
  const entrepreneur = w.session?.user?.role === "entrepreneur";
  const [record, setRecord] = useState<Submission | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("overview"),
    [sourceTab, setSourceTab] = useState("compare"),
    [selected, setSelected] = useState<string[]>([]),
    [repair, setRepair] = useState(false),
    [repairField, setRepairField] = useState<FieldKey | undefined>(),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [matches, setMatches] = useState<SimilarIdea[]>([]);
  const [questionGroup, setQuestionGroup] = useState("all"),
    [questionSearch, setQuestionSearch] = useState("");
  const [detailView, setDetailView] = useState("simple");
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true)),
      after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  const [allQuestions, setAllQuestions] = useState(false),
    [sourceOpen, setSourceOpen] = useState(false);
  const loadRevision = useRef(0);
  useEffect(() => {
    setDetailView("simple");
    setAllQuestions(false);
    setSourceOpen(false);
    setRecord(null);
    setSelected([]);
    setSourceTab("compare");
    setTab("overview");
    setQuestionGroup("all");
    setQuestionSearch("");
    setRepair(false);
    setReview(false);
  }, [id]);
  const reload = useCallback(async () => {
    const requestRevision = ++loadRevision.current;
    try {
      if (id?.startsWith("example-")) {
        const example = w.submissions.find((s) => s.id === id);
        if (!example)
          throw new Error("Example not found in the current workspace.");
        if (requestRevision !== loadRevision.current) return;
        setRecord(example);
      } else {
        const response = await api<{ submission: Submission }>(
          `/submissions/${id}`,
        );
        if (requestRevision !== loadRevision.current) return;
        setRecord(response.submission);
      }
      setError("");
    } catch (e) {
      if (requestRevision !== loadRevision.current) return;
      setError(e instanceof Error ? e.message : "Could not open assessment.");
    }
  }, [id, w.submissions]);
  useEffect(() => {
    void reload();
    return () => {
      loadRevision.current++;
    };
  }, [reload]);
  useEffect(() => {
    if (
      !record ||
      !["queued", "processing", "needs_review"].includes(record.status)
    )
      return;
    const timer = setInterval(
      () => void reload(),
      record.status === "needs_review" ? 15000 : 3500,
    );
    return () => clearInterval(timer);
  }, [record?.status, reload]);
  useEffect(() => {
    if (search.get("view") === "full") setDetailView("full");
    if (search.get("repair") === "1") {
      const requestedField = search.get("field");
      if (FIELD_KEYS.includes(requestedField as FieldKey))
        setRepairField(requestedField as FieldKey);
      setRepair(true);
    }
  }, [search]);
  useEffect(() => {
    if (!record?.assessment) return;
    if (entrepreneur) {
      setMatches([]);
      return;
    }
    if (record.example) {
      const terms = (s: Submission) =>
        new Set(
          `${s.title} ${s.assessment?.fields.find((f) => f.key === "trade")?.value ?? ""}`
            .toLowerCase()
            .match(/\w{3,}/g) ?? [],
        );
      const x = terms(record);
      setMatches(
        w.submissions
          .filter((s) => s.id !== record.id)
          .map((s) => ({
            submission: s,
            similarity: 0,
            method: "keyword" as const,
            matchedTerms: [...terms(s)].filter((t) => x.has(t)),
          }))
          .filter((s) => s.matchedTerms.length > 0)
          .slice(0, 3),
      );
    } else
      void api<{ matches: SimilarIdea[] }>(`/submissions/${record.id}/similar`)
        .then((r) => setMatches(r.matches))
        .catch(() => setMatches([]));
  }, [record?.id, record?.assessment?.version, w.submissions, entrepreneur]);
  async function verify() {
    if (!record?.assessment) return;
    setBusy(true);
    try {
      const r = await api<{ submission: Submission }>(
        `/submissions/${record.id}/verify`,
        {
          method: "POST",
          body: JSON.stringify({
            segmentIds: selected.length
              ? selected
              : record.assessment.segments.map((s) => s.id),
            version: record.assessment.version,
          }),
        },
      );
      setRecord(r.submission);
      void w.refresh();
      w.notify("Evidence verification saved as a new assessment version.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify evidence.");
    } finally {
      setBusy(false);
    }
  }
  if (error && !record)
    return (
      <Notice type="error">
        {error} <Link to="/submissions">{t("Back to submissions")}</Link>
      </Notice>
    );
  if (!record) return <Busy label={t("Opening assessment")} />;
  const a = record.assessment;
  const visibleQuestions =
    a?.questions.filter(
      (q) =>
        (questionGroup === "all" ||
          QUESTION_GROUPS.find(
            (group) => group.key === questionGroup,
          )?.fields.includes(q.field)) &&
        `${t(FIELD_LABELS[q.field])} ${questionText(q)} ${q.question} ${t(PARAMETER_QUESTIONS[q.field].hint)}`
          .toLocaleLowerCase()
          .includes(questionSearch.trim().toLocaleLowerCase()),
    ) ?? [];
  return (
    <>
      {printing && <AssessmentPrint record={record} />}
      <Link to="/submissions" className="back-link">
        <ArrowLeft size={14} />
        {t("All submissions")}
      </Link>
      <div className="detail-intro">
        <div>
          <div className="eyebrow">
            {t("BUSINESS IDEA ASSESSMENT")}{" "}
            {a && (
              <span>
                {t("· VERSION")} {a.version}
              </span>
            )}
          </div>
          <h1>{record.title}</h1>
          {!entrepreneur && !record.example && (
            <CohortAssignment
              key={record.id + (record.cohortId ?? "")}
              record={record}
              onSaved={setRecord}
            />
          )}
          <div className="detail-meta">
            <span>{record.beneficiaryName}</span>
            <span>
              <Icon type={record.inputType} />
              {record.language}
            </span>
            <span>
              {record.cohortName ?? "Cohort unassigned"}
              {record.cohortSynthetic ? t(" · demo") : ""}
            </span>
            <Status status={record.status} />
          </div>
        </div>
        <div className="intro-action">
          <button
            className="button secondary"
            onClick={() => window.print()}
            disabled={!a}
          >
            <Printer size={15} />
            {t("Export report")}
          </button>
          {!entrepreneur && (
            <button
              className="button primary"
              onClick={() => setReview(true)}
              disabled={!a || record.example}
            >
              <CheckCheck size={16} />
              {t("Add review")}
            </button>
          )}
        </div>
      </div>
      {record.example && (
        <Notice>
          {t(
            "Illustrative assessment with synthetic profiles and cohorts. Live changes are available after",
          )}{" "}
          <Link to="/settings">{t("connecting your workspace")}</Link>.
        </Notice>
      )}
      {error && <Notice type="error">{error}</Notice>}
      {a && entrepreneur && (
        <div
          className="friendly-view-switch"
          role="group"
          aria-label={t("Choose a view")}
        >
          <button
            type="button"
            aria-pressed={detailView === "simple"}
            onClick={() => setDetailView("simple")}
          >
            {t("Simple view")}
          </button>
          <button
            type="button"
            data-testid="open-full-view"
            aria-pressed={detailView === "full"}
            onClick={() => setDetailView("full")}
          >
            {t("Full details")}
          </button>
        </div>
      )}
      {!a ? (
        <section className="panel processing-panel">
          <div className="processing-symbol">
            {record.status !== "processing" ? (
              <Info size={28} />
            ) : (
              <Loader2 size={28} className="spin" />
            )}
          </div>
          <h2>
            {record.status === "failed"
              ? t("This submission needs attention")
              : record.errorCode?.includes("QUOTA") ||
                  record.errorCode === "PROVIDER_RATE_LIMITED"
                ? t("Waiting for AI service quota")
                : record.status === "queued"
                  ? t("Your submission is in the queue")
                  : t("Bringing the evidence together")}
          </h2>
          <p>{t(record.error ?? record.stage)}</p>
          {record.nextRetryAt && record.status === "queued" && (
            <p>
              {t("Next automatic attempt:")}{" "}
              {new Date(record.nextRetryAt).toLocaleString()}
              {t(". You can leave this page; no resubmission is needed.")}
            </p>
          )}
          <div className="processing-steps">
            <span className="complete">
              <Check size={14} />
              {t("Original saved")}
            </span>
            <span className={record.status === "processing" ? "current" : ""}>
              {t("Read & translate")}
            </span>
            <span>{t("Validate evidence")}</span>
            <span>{t("Assess & compare")}</span>
          </div>
          {record.status === "failed" && (
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/submissions/${record.id}/retry`, {
                    method: "POST",
                  });
                  await reload();
                } catch (e) {
                  setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={15} />
              {t("Retry processing")}
            </button>
          )}
        </section>
      ) : entrepreneur && detailView === "simple" ? (
        <div className="entrepreneur-simple">
          <IdeaVisualizer
            key={record.id}
            record={record}
            onAnswer={(field) => {
              setRepairField(field);
              setRepair(true);
            }}
            onDetails={() => setDetailView("full")}
          />
          <BusinessNextSteps
            key={record.id + a.version}
            record={record}
            onAnswer={(field) => {
              setRepairField(field);
              setRepair(true);
            }}
          />
        </div>
      ) : (
        <>
          <div className="assessment-summary">
            <div className="score-block">
              <span className="eyebrow">{t("INFORMATION READINESS")}</span>
              <ValueHelp topic="readiness">
                <div className="score-number">
                  {a.score ?? "—"}
                  <span>{a.score == null ? t("Not assessable") : "/ 100"}</span>
                </div>
              </ValueHelp>
              <p>{t("Supporting information, not predicted success.")}</p>
            </div>
            <div className="summary-measure">
              <div>
                <span>{t("Core information completeness")}</span>
                <ValueHelp topic="completeness">
                  <strong>{a.completeness}%</strong>
                </ValueHelp>
              </div>
              <Progress value={a.completeness} />
              <p>
                {a.questions.length} {t("parameters need answers")}
              </p>
            </div>
            <div className="summary-measure">
              <div>
                <span>{t("Assessment coverage")}</span>
                <ValueHelp topic="coverage">
                  <strong>{a.coverage}%</strong>
                </ValueHelp>
              </div>
              <Progress value={a.coverage} />
              <p>
                {a.reviewRequired
                  ? t("Human verification or clarification required")
                  : t("Source evidence checked for this version")}
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => setRepair(true)}
              disabled={!a.questions.length}
            >
              <MessageSquare size={16} />
              {t("Resolve gaps")} <ArrowRight size={14} />
            </button>
          </div>
          <ScoreExplanation assessment={a} />
          <div className="detail-tabs">
            <button
              className={tab === "overview" ? "active" : ""}
              onClick={() => setTab("overview")}
            >
              {t("Assessment overview")}
            </button>
            {!entrepreneur && (
              <button
                className={tab === "context" ? "active" : ""}
                onClick={() => setTab("context")}
              >
                {t("Similar ideas & local context")}
              </button>
            )}
            <button
              className={tab === "history" ? "active" : ""}
              onClick={() => setTab("history")}
            >
              {t("Version history")}{" "}
              <span className="count-pill">{record.history.length + 1}</span>
            </button>
          </div>
          {tab === "overview" ? (
            <div className="assessment-layout">
              <section className="assessment-main">
                {!entrepreneur && (
                  <AssessorInsights
                    record={record}
                    onEvidence={(ids) => {
                      setSelected(ids);
                      setSourceTab("compare");
                      setSourceOpen(true);
                    }}
                    onNearby={() => setTab("context")}
                  />
                )}
                {(!entrepreneur || !!record.review?.domainRatings?.length) && (
                  <PotentialReviewResult
                    record={record}
                    onEvidence={(ids) => {
                      setSelected(ids);
                      setSourceTab("compare");
                      setSourceOpen(true);
                    }}
                  />
                )}
                <MissingAnswers
                  assessment={a}
                  onAnswer={(field) => {
                    setRepairField(field);
                    setRepair(true);
                  }}
                  onBrowse={() => setAllQuestions(true)}
                  onSources={() => setSourceOpen(true)}
                />
                {allQuestions && (
                  <Modal
                    title={t("All questions")}
                    onClose={() => setAllQuestions(false)}
                    wide
                  >
                    {" "}
                    <section className="panel completion-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>{t("Complete missing information")}</h2>
                          <p>
                            {FIELD_KEYS.length - a.questions.length} {t("of")}{" "}
                            {FIELD_KEYS.length}{" "}
                            {t(
                              "parameters answered. Only unanswered or unclear information is shown below.",
                            )}
                          </p>
                          {a.questions.length > 0 && (
                            <p className="hint">
                              {t("Start with")}{" "}
                              {a.questions
                                .slice(0, 3)
                                .map((q) => FIELD_LABELS[q.field])
                                .join(", ")}
                              {t(
                                ". You can answer in stages; missing information is not a judgement of business quality.",
                              )}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          className="button secondary small"
                          onClick={() =>
                            download(
                              `strive-checklist-v${a.version}.txt`,
                              preparationChecklist(record),
                            )
                          }
                        >
                          <Download size={14} />
                          {t("Download checklist")}
                        </button>
                      </div>
                      {a.questions.length ? (
                        <>
                          <div className="completion-tools">
                            <div
                              className="question-filters"
                              role="group"
                              aria-label={t("Question categories")}
                            >
                              {[
                                {
                                  key: "all",
                                  label: "All",
                                  fields: FIELD_KEYS,
                                },
                                ...QUESTION_GROUPS,
                              ].map((group) => (
                                <button
                                  type="button"
                                  aria-pressed={questionGroup === group.key}
                                  key={group.key}
                                  onClick={() => setQuestionGroup(group.key)}
                                >
                                  {t(group.label)}
                                  <span>
                                    {
                                      a.questions.filter((q) =>
                                        group.fields.includes(q.field),
                                      ).length
                                    }
                                  </span>
                                </button>
                              ))}
                            </div>
                            <div className="question-search">
                              <Search size={16} />
                              <input
                                aria-label={t("Search missing information")}
                                placeholder={t("Find a question…")}
                                value={questionSearch}
                                onChange={(event) =>
                                  setQuestionSearch(event.target.value)
                                }
                              />
                            </div>
                            <span className="hint" role="status">
                              {t("Showing")} {visibleQuestions.length} {t("of")}{" "}
                              {a.questions.length} {t("open questions")}
                            </span>
                          </div>
                          <div className="completion-questions">
                            {visibleQuestions.map((q) => (
                              <article
                                className="completion-question"
                                key={q.field}
                              >
                                <div>
                                  <span className="eyebrow">
                                    {t(FIELD_LABELS[q.field])}
                                  </span>
                                  <h3>{questionText(q)}</h3>

                                  <details className="question-guidance">
                                    <summary>{t("Answer guidance")}</summary>
                                    <p>
                                      {t(PARAMETER_QUESTIONS[q.field].hint)}
                                    </p>
                                  </details>
                                </div>
                                <button
                                  className="button secondary small"
                                  onClick={() => {
                                    setAllQuestions(false);
                                    setRepairField(q.field);
                                    setRepair(true);
                                  }}
                                  aria-label={`Answer ${t(FIELD_LABELS[q.field])}`}
                                >
                                  {t("Answer")} <ArrowRight size={14} />
                                </button>
                              </article>
                            ))}
                            {!visibleQuestions.length && (
                              <div className="question-empty">
                                <h3>{t("No questions match these filters")}</h3>
                                <button
                                  type="button"
                                  className="button secondary small"
                                  onClick={() => {
                                    setQuestionGroup("all");
                                    setQuestionSearch("");
                                  }}
                                >
                                  {t("Show all open questions")}
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="notes-body">
                          <p>
                            {t(
                              "All parameters have answers in the available evidence. No additional questions are needed.",
                            )}
                          </p>
                        </div>
                      )}
                    </section>
                  </Modal>
                )}

                <details className="panel friendly-detail-group">
                  <summary>{t("The business, at a glance")}</summary>
                  <div className="panel-heading">
                    <div>
                      <h2>{t("The business, at a glance")}</h2>
                      <p>
                        {t(
                          "Applicant-stated facts quoted from the available evidence.",
                        )}
                      </p>
                    </div>
                    <span className="outline-label">{t("SOURCE LINKED")}</span>
                  </div>
                  <div className="facts-grid">
                    {a.fields
                      .filter((f) => !["trade", "sector"].includes(f.key))
                      .map((f) => (
                        <FieldCard
                          key={f.key}
                          field={f}
                          onEvidence={(ids) => {
                            setSelected(ids);
                            setSourceTab("compare");
                            setSourceOpen(true);
                          }}
                        />
                      ))}
                  </div>
                </details>
                <details className="panel friendly-detail-group">
                  <summary>{t("Assessment dimensions")}</summary>
                  <div className="panel-heading">
                    <div>
                      <h2>{t("Assessment dimensions")}</h2>
                      <p>
                        {t(
                          "Deterministic rubric · 0–4 · unknown is different from zero.",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="dimension-list">
                    {a.dimensions.map((d) => (
                      <div className="dimension-row" key={d.key}>
                        <div className="dimension-heading">
                          <strong>{t(d.label)}</strong>
                          <DimensionHelp
                            dimension={d.key}
                            label={d.label}
                            score={d.score}
                            weight={d.weight}
                          >
                            <span>
                              {d.score == null
                                ? t("Not assessable")
                                : `${d.score} / 4`}
                            </span>
                          </DimensionHelp>
                        </div>
                        <div className="dimension-steps">
                          {[1, 2, 3, 4].map((step) => (
                            <span
                              key={step}
                              className={
                                d.score != null && d.score >= step
                                  ? "filled"
                                  : ""
                              }
                            />
                          ))}
                        </div>
                        <details className="rating-explanation">
                          <summary>{t("Why this score?")}</summary>
                          <p>{t(d.explanation)}</p>
                        </details>
                        {d.evidenceIds.length > 0 && (
                          <button
                            className="evidence-link"
                            onClick={() => {
                              setSelected(d.evidenceIds);
                              setSourceTab("compare");
                              setSourceOpen(true);
                            }}
                          >
                            {t("View supporting evidence")}{" "}
                            <ArrowUpRight size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="panel-footer">
                    <Info size={14} />
                    {t("Rubric")} {a.rubricVersion}
                    {t(
                      ". Weights are product rules, not learned business-outcome predictions.",
                    )}
                  </div>
                </details>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>{t("Assessor notes & next steps")}</h2>
                  </div>
                  <div className="notes-body">
                    {record.review ? (
                      <>
                        <span className="outline-label">
                          {record.review.decision.replaceAll("_", " ")}
                        </span>
                        <p>{record.review.note}</p>
                        {record.review.nextAction && (
                          <p>
                            <strong>{t("Next action:")} </strong>
                            {record.review.nextAction}
                          </p>
                        )}
                        {record.review.reasonCodes?.length ? (
                          <p className="hint">
                            {t("Reasons:")}{" "}
                            {record.review.reasonCodes
                              .map(
                                (key) =>
                                  REVIEW_REASONS.find(
                                    ([value]) => value === key,
                                  )?.[1] ?? key,
                              )
                              .join(" · ")}
                          </p>
                        ) : null}
                        {record.review.evidenceIds?.length ? (
                          <p className="hint">
                            {t("Supporting evidence:")}{" "}
                            {record.review.evidenceIds.join(", ")}
                          </p>
                        ) : null}
                        <span className="hint">
                          {t("Reviewed")}{" "}
                          {new Date(
                            record.review.reviewedAt,
                          ).toLocaleDateString("en-IN")}
                        </span>
                      </>
                    ) : (
                      <p className="muted">
                        {t(
                          "No assessor review recorded. Review the source and unresolved questions before choosing the next step.",
                        )}
                      </p>
                    )}
                  </div>
                </section>
              </section>
              <aside className="source-column">
                {entrepreneur ? (
                  <section className="panel source-launcher">
                    <FileText size={25} />
                    <h3>{t("Original sources")}</h3>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setSourceOpen(true)}
                    >
                      {t("Open sources")}
                      <ArrowUpRight size={15} />
                    </button>
                  </section>
                ) : (
                  <EvidencePanel
                    key={record.id}
                    record={record}
                    selected={selected}
                    onSelect={setSelected}
                    mode={sourceTab}
                    onModeChange={setSourceTab}
                    onVerify={() => void verify()}
                    busy={busy}
                    readOnly={!!entrepreneur}
                  />
                )}
                {entrepreneur && sourceOpen && (
                  <Modal
                    title={t("Original sources")}
                    onClose={() => setSourceOpen(false)}
                    wide
                  >
                    {" "}
                    <EvidencePanel
                      key={record.id}
                      record={record}
                      selected={selected}
                      onSelect={setSelected}
                      mode={sourceTab}
                      onModeChange={setSourceTab}
                      onVerify={() => void verify()}
                      busy={busy}
                      readOnly={!!entrepreneur}
                    />
                  </Modal>
                )}

                <details className="panel limits-panel friendly-detail-group">
                  <summary>{t("What to keep in mind")}</summary>
                  <div className="panel-heading">
                    <h3>
                      <ShieldCheck size={16} />
                      {t("What to keep in mind")}
                    </h3>
                  </div>
                  <ul>
                    {a.warnings
                      .filter((v) => !v.startsWith("Synthetic"))
                      .map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    <li>
                      {t(
                        "Source references establish traceability. They do not independently verify the applicant’s claims.",
                      )}
                    </li>
                  </ul>
                </details>
              </aside>
            </div>
          ) : tab === "context" ? (
            <div className="context-layout">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>{t("Related business ideas")}</h2>
                    <p>
                      {t(
                        "Similarity helps identify overlap; it is not a recommendation or a truth check.",
                      )}
                    </p>
                  </div>
                </div>
                {matches.length ? (
                  <div className="similar-list">
                    {matches.map((m) => (
                      <div key={m.submission.id} className="similar-card">
                        <div className="similar-icon">
                          <Icon type={m.submission.inputType} />
                        </div>
                        <div>
                          <h3><Link to={`/submissions/${m.submission.id}`}>{m.submission.title}</Link></h3>
                          <p>
                            {m.submission.beneficiaryName} ·{" "}
                            {m.submission.cohortName ?? "Unassigned cohort"}
                          </p>
                          <div className="match-tags">
                            {m.matchedTerms.map((t) => (
                              <span key={t}>{t}</span>
                            ))}
                          </div>
                          <ValueHelp topic="similarity"><small>
                            {m.method === "embedding"
                              ? t("Semantic similarity")
                              : t("Keyword overlap")}
                            {m.method === "embedding"
                              ? ` · ${m.similarity.toFixed(2)} cosine score`
                              : ""}
                          </small></ValueHelp>
                        </div>
                        <Link to={`/submissions/${m.submission.id}`} aria-label={t("Open {title}",{title:m.submission.title})}><ArrowUpRight size={17}/></Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title={t("No related ideas found")}
                    description={t(
                      "Matches will appear as more distinct business proposals are assessed.",
                    )}
                  />
                )}
              </section>
              <LocationPanel
                submissionId={record.id}
                example={!!record.example}
                location={
                  a.fields.find((f) => f.key === "location")?.value ?? ""
                }
              />
            </div>
          ) : (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>{t("Evidence changes. The assessment follows.")}</h2>
                  <p>
                    {t("Every clarification preserves the earlier assessment.")}
                  </p>
                </div>
              </div>
              <div className="history-list">
                {[...record.history, a].reverse().map((version, index, all) => {
                  const previous = all[index + 1];
                  const changed = previous
                    ? version.fields.filter((f) => {
                        const old = previous.fields.find(
                          (p) => p.key === f.key,
                        );
                        return (
                          old?.value !== f.value || old?.status !== f.status
                        );
                      })
                    : [];
                  return (
                    <article className="history-item" key={version.version}>
                      <div className="history-icon">
                        <History size={17} />
                      </div>
                      <div>
                        <h3>
                          {t("Version")} {version.version}{" "}
                          <span className="small-label">
                            {index === 0 ? t("CURRENT") : t("PREVIOUS")}
                          </span>
                        </h3>
                        <p>
                          {new Date(version.createdAt).toLocaleString("en-IN")}{" "}
                          {t("· Completeness")} {version.completeness}
                          {t("% · Assessment")}{" "}
                          <ValueHelp topic="readiness">{version.score ?? t("Not enough details")}</ValueHelp>
                        </p>
                        {changed.map((f) => (
                          <div className="history-change" key={f.key}>
                            <strong>{t(FIELD_LABELS[f.key])}</strong>
                            <span>
                              {previous?.fields.find((p) => p.key === f.key)
                                ?.value ?? "Unknown / conflicting"}{" "}
                              <ArrowRight size={13} />{" "}
                              {f.value ?? "Unknown / conflicting"}
                            </span>
                          </div>
                        ))}
                        {!previous && (
                          <small>
                            {t("Initial extraction and assessment.")}
                          </small>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
      {repair && a && (
        <RepairModal
          record={record}
          initialField={repairField}
          onClose={() => setRepair(false)}
          onSaved={(updated) => {
            setRecord(updated);
            if (!updated.assessment?.questions.length) setRepair(false);
            void w.refresh();
            w.notify(
              "Clarification saved. Review the evidence and updated assessment.",
            );
          }}
        />
      )}
      {review && a && (
        <ReviewModal
          record={record}
          onClose={() => setReview(false)}
          onSaved={(updated) => {
            setRecord(updated);
            setReview(false);
            void w.refresh();
            w.notify("Assessor review saved.");
          }}
        />
      )}
    </>
  );
}
function RepairModal({
  record,
  initialField,
  onClose,
  onSaved,
}: {
  record: Submission;
  initialField?: FieldKey;
  onClose: () => void;
  onSaved: (s: Submission) => void;
}) {
  useLanguage();
  const [a, setAssessment] = useState(record.assessment!);
  const stale = a.version !== record.assessment!.version;
  const [questionId, setQuestionId] = useState(
      a.questions.find((q) => q.field === initialField)?.id ??
        a.questions[0]?.id ??
        "",
    ),
    [answer, setAnswer] = useState(""),
    [mode, setMode] = useState("text"),
    [file, setFile] = useState<File | null>(null),
    [language, setLanguage] = useState("auto"),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const q = a.questions.find((q) => q.id === questionId) ?? a.questions[0];
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!q) return;
    setPending(true);
    setError("");
    try {
      const form = new FormData();
      form.set("field", q.field);
      form.set("version", String(a.version));
      form.set("language", language);
      if (mode === "audio" && file) form.set("file", file);
      else if (mode === "audio") throw new Error("Record an answer first.");
      else form.set("answer", answer);
      const result = await api<{ submission: Submission }>(
        `/submissions/${record.id}/clarifications`,
        { method: "POST", body: form },
      );
      setAnswer("");
      setFile(null);
      setAssessment(result.submission.assessment!);
      setQuestionId(result.submission.assessment?.questions[0]?.id ?? "");
      onSaved(result.submission);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save the clarification.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal title={t("Evidence Repair Loop")} onClose={onClose}>
      <div className="modal-content">
        <div className="repair-intro">
          <span className="document-icon">
            <MessageSquare size={20} />
          </span>
          <p>
            {a.questions.length}{" "}
            {t(
              "parameters still need answers. Information already found in your input is not asked again. Answers may change the assessment in either direction.",
            )}
          </p>
        </div>
        {!q ? (
          <Empty
            title={t("No open questions")}
            description={t(
              "Review the source evidence or add an assessor note.",
            )}
          />
        ) : (
          <form onSubmit={save}>
            <label>
              {t("Information to clarify")}
              <select
                value={q.id}
                disabled={pending}
                onChange={(e) => {
                  setQuestionId(e.target.value);
                  setAnswer("");
                  setFile(null);
                }}
              >
                {a.questions.map((question) => (
                  <option key={question.id} value={question.id}>
                    {t(FIELD_LABELS[question.field])}
                  </option>
                ))}
              </select>
            </label>
            <div className="question-card">
              <div className="eyebrow">{t("QUESTION FOR THE BENEFICIARY")}</div>
              <h3>{questionText(q)}</h3>

              <details className="question-guidance">
                <summary>{t("Answer guidance")}</summary>
                <small>{t(q.reason)}</small>
                <p>{t(PARAMETER_QUESTIONS[q.field].hint)}</p>
              </details>
            </div>
            <label>
              {t("Answer language")}
              <select
                value={language}
                disabled={pending}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="segmented-control">
              <button
                type="button"
                className={mode === "text" ? "active" : ""}
                disabled={pending}
                onClick={() => setMode("text")}
              >
                <AlignLeft size={14} />
                {t("Type an answer")}
              </button>
              <button
                type="button"
                className={mode === "audio" ? "active" : ""}
                disabled={pending}
                onClick={() => setMode("audio")}
              >
                <Mic size={14} />
                {t("Record an answer")}
              </button>
            </div>
            {mode === "text" ? (
              <label>
                {t("Your clarification")}
                <textarea
                  required
                  minLength={1}
                  maxLength={2000}
                  rows={5}
                  value={answer}
                  disabled={pending}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={t(
                    "Provide the missing detail or explain which conflicting value is correct.",
                  )}
                />
              </label>
            ) : (
              <Recorder onFile={setFile} disabled={pending} />
            )}
            <p className="hint">
              {t(
                "The original remains unchanged. Your clarification becomes a new evidence source and assessment version.",
              )}
            </p>
            {record.example && (
              <Notice>
                {t(
                  "This example is read-only. Connect your workspace to save clarifications on live submissions.",
                )}
              </Notice>
            )}
            {error && <Notice type="error">{error}</Notice>}
            {stale && (
              <Notice>
                {t(
                  "This assessment has changed. Close and reopen these questions before answering.",
                )}
              </Notice>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={onClose}
              >
                {t("Close")}
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={pending || record.example || stale}
              >
                {pending ? (
                  <Loader2 size={15} className="spin" />
                ) : (
                  <ArrowRight size={15} />
                )}
                {t("Save & reassess")}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
function ReviewModal({
  record,
  onClose,
  onSaved,
}: {
  record: Submission;
  onClose: () => void;
  onSaved: (s: Submission) => void;
}) {
  useLanguage();
  const [decision, setDecision] = useState(""),
    [note, setNote] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [nextAction, setNextAction] = useState("");
  const [sourceReviewed, setSourceReviewed] = useState(false);
  const [domainRatings, setDomainRatings] = useState<DomainRating[]>(
    record.review?.assessmentVersion === record.assessment?.version
      ? (record.review?.domainRatings ?? [])
      : [],
  );
  return (
    <Modal title={t("Record assessor review")} onClose={onClose}>
      <form
        className="modal-content"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const parsed = assessorReviewSchema.safeParse({
            decision,
            note,
            nextAction,
            reasonCodes: reasons,
            evidenceIds: evidence,
            sourceReviewed,
            domainRatings,
            version: record.assessment!.version,
          });
          if (!parsed.success) {
            setError(
              [
                ...new Set(parsed.error.issues.map((issue) => issue.message)),
              ].join(" "),
            );
            return;
          }
          setPending(true);
          try {
            const result = await api<{ submission: Submission }>(
              `/submissions/${record.id}/review`,
              {
                method: "POST",
                body: JSON.stringify(parsed.data),
              },
            );
            onSaved(result.submission);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save review.");
          } finally {
            setPending(false);
          }
        }}
      >
        <Notice>
          {t(
            "This review records your professional judgement. AI assessment does not determine funding eligibility.",
          )}
        </Notice>
        <label>
          {t("Recommended next step")}
          <select
            required
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
          >
            <option value="">{t("Select a next step")}</option>
            <option value="mentoring">
              {t("Mentoring / skilling conversation")}
            </option>
            <option value="deeper_evaluation">{t("Deeper evaluation")}</option>
            <option value="clarification">{t("Further clarification")}</option>
            <option value="reviewed">
              {t("Reviewed — no next step recorded")}
            </option>
          </select>
        </label>
        <label>
          {t("Review rationale")}
          <textarea
            rows={5}
            required
            minLength={20}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t(
              "Explain the next step and any information that needs validation.",
            )}
          />
        </label>
        <fieldset className="review-checklist">
          <legend>{t("Review reasons — choose 1 to 4")}</legend>
          {REVIEW_REASONS.map(([key, label]) => (
            <label key={key} className="check-line">
              <input
                type="checkbox"
                checked={reasons.includes(key)}
                disabled={!reasons.includes(key) && reasons.length >= 4}
                onChange={(event) =>
                  setReasons(
                    event.target.checked
                      ? [...reasons, key]
                      : reasons.filter((value) => value !== key),
                  )
                }
              />
              {t(label)}
            </label>
          ))}
        </fieldset>
        <label>
          {t("Next action")}{" "}
          {decision === "reviewed" && (
            <span className="optional">{t("optional")}</span>
          )}
          <textarea
            rows={3}
            required={decision !== "reviewed"}
            minLength={decision === "reviewed" ? undefined : 10}
            maxLength={600}
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder={t(
              "Describe who should do what next, and which information should be checked.",
            )}
          />
        </label>
        <fieldset className="review-checklist">
          <legend>{t("Supporting source evidence — choose 1 to 20")}</legend>
          {record.assessment!.segments.map((segment) => (
            <label key={segment.id} className="check-line">
              <input
                type="checkbox"
                checked={evidence.includes(segment.id)}
                disabled={
                  !evidence.includes(segment.id) && evidence.length >= 20
                }
                onChange={(event) =>
                  setEvidence(
                    event.target.checked
                      ? [...evidence, segment.id]
                      : evidence.filter((value) => value !== segment.id),
                  )
                }
              />
              <span>
                <strong>{segment.id}</strong>{" "}
                {segment.englishText.slice(0, 180)}
                {segment.englishText.length > 180 ? "…" : ""}
              </span>
            </label>
          ))}
        </fieldset>
        <PotentialReviewFields
          record={record}
          ratings={domainRatings}
          onChange={setDomainRatings}
          disabled={pending}
        />
        <label className="check-line">
          <input
            type="checkbox"
            checked={sourceReviewed}
            onChange={(event) => setSourceReviewed(event.target.checked)}
            required
          />
          {t(
            "I reviewed the original source and the evidence supporting this recommendation.",
          )}
        </label>
        {error && <Notice type="error">{error}</Notice>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button className="button primary" disabled={pending}>
            {pending ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <Check size={15} />
            )}
            {t("Save review")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
