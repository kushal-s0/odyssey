import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  FileText,
  History,
  Info,
  Loader2,
  MapPin,
  MessageSquare,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ExternalLink,
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
  type LocalInsights,
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
import CohortAssignment from "../CohortAssignment";
import { PotentialReviewFields, PotentialReviewResult } from "../PotentialReview";
import type { DomainRating } from "../../../shared/business-review";
import { BUSINESS_CATEGORIES } from "../../../shared/business-categories";
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
  const sourceRef = useRef<HTMLDivElement>(null);
  const [questionGroup, setQuestionGroup] = useState("all"),
    [questionSearch, setQuestionSearch] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const reload = useCallback(async () => {
    try {
      if (id?.startsWith("example-")) {
        const example = w.submissions.find((s) => s.id === id);
        if (!example)
          throw new Error("Example not found in the current workspace.");
        setRecord(example);
      } else {
        const response = await api<{ submission: Submission }>(
          `/submissions/${id}`,
        );
        setRecord(response.submission);
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open assessment.");
    }
  }, [id, w.submissions]);
  useEffect(() => {
    void reload();
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
    if (search.get("repair") === "1") setRepair(true);
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
  useEffect(() => {
    if (selected[0])
      document
        .getElementById(`source-${selected[0]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const segment = record?.assessment?.segments.find(
      (s) => s.id === selected[0],
    );
    if (segment?.startSeconds != null && audioRef.current)
      audioRef.current.currentTime = segment.startSeconds;
  }, [selected, record]);
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
        {error} <Link to="/submissions">Back to submissions</Link>
      </Notice>
    );
  if (!record) return <Busy label="Opening assessment" />;
  const a = record.assessment;
  const visibleQuestions =
    a?.questions.filter(
      (q) =>
        (questionGroup === "all" ||
          QUESTION_GROUPS.find(
            (group) => group.key === questionGroup,
          )?.fields.includes(q.field)) &&
        `${FIELD_LABELS[q.field]} ${q.question} ${PARAMETER_QUESTIONS[q.field].hint}`
          .toLocaleLowerCase()
          .includes(questionSearch.trim().toLocaleLowerCase()),
    ) ?? [];
  return (
    <>
      <Link to="/submissions" className="back-link">
        <ArrowLeft size={14} />
        All submissions
      </Link>
      <div className="detail-intro">
        <div>
          <div className="eyebrow">
            BUSINESS IDEA ASSESSMENT {a && <span>· VERSION {a.version}</span>}
          </div>
          <h1>{record.title}</h1>
          {!entrepreneur && !record.example && <CohortAssignment key={record.id + (record.cohortId ?? "")} record={record} onSaved={setRecord} />}
          <div className="detail-meta">
            <span>{record.beneficiaryName}</span>
            <span>
              <Icon type={record.inputType} />
              {record.language}
            </span>
            <span>
              {record.cohortName ?? "Cohort unassigned"}
              {record.cohortSynthetic ? " · demo" : ""}
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
            Export report
          </button>
          {!entrepreneur && (
            <button
              className="button primary"
              onClick={() => setReview(true)}
              disabled={!a || record.example}
            >
              <CheckCheck size={16} />
              Add review
            </button>
          )}
        </div>
      </div>
      {record.example && (
        <Notice>
          Illustrative assessment with synthetic profiles and cohorts. Live
          changes are available after{" "}
          <Link to="/settings">connecting your workspace</Link>.
        </Notice>
      )}
      {error && <Notice type="error">{error}</Notice>}
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
              ? "This submission needs attention"
              : record.errorCode?.includes("QUOTA") ||
                  record.errorCode === "PROVIDER_RATE_LIMITED"
                ? "Waiting for AI service quota"
                : record.status === "queued"
                  ? "Your submission is in the queue"
                  : "Bringing the evidence together"}
          </h2>
          <p>{record.error ?? record.stage}</p>
          {record.nextRetryAt && record.status === "queued" && (
            <p>
              Next automatic attempt:{" "}
              {new Date(record.nextRetryAt).toLocaleString()}. You can leave
              this page; no resubmission is needed.
            </p>
          )}
          <div className="processing-steps">
            <span className="complete">
              <Check size={14} />
              Original saved
            </span>
            <span className={record.status === "processing" ? "current" : ""}>
              Read & translate
            </span>
            <span>Validate evidence</span>
            <span>Assess & compare</span>
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
              Retry processing
            </button>
          )}
        </section>
      ) : (
        <>
          <div className="assessment-summary">
            <div className="score-block">
              <span className="eyebrow">INFORMATION READINESS</span>
              <div className="score-number">
                {a.score ?? "—"}
                <span>{a.score == null ? "Not assessable" : "/ 100"}</span>
              </div>
              <p>Supporting information, not predicted success.</p>
            </div>
            <div className="summary-measure">
              <div>
                <span>Core information completeness</span>
                <strong>{a.completeness}%</strong>
              </div>
              <Progress value={a.completeness} />
              <p>{a.questions.length} parameters need answers</p>
            </div>
            <div className="summary-measure">
              <div>
                <span>Assessment coverage</span>
                <strong>{a.coverage}%</strong>
              </div>
              <Progress value={a.coverage} />
              <p>
                {a.reviewRequired
                  ? "Human verification or clarification required"
                  : "Source evidence checked for this version"}
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => setRepair(true)}
              disabled={!a.questions.length}
            >
              <MessageSquare size={16} />
              Resolve gaps <ArrowRight size={14} />
            </button>
          </div>
          <div className="detail-tabs">
            <button
              className={tab === "overview" ? "active" : ""}
              onClick={() => setTab("overview")}
            >
              Assessment overview
            </button>
            {!entrepreneur && (
              <button
                className={tab === "context" ? "active" : ""}
                onClick={() => setTab("context")}
              >
                Similar ideas & local context
              </button>
            )}
            <button
              className={tab === "history" ? "active" : ""}
              onClick={() => setTab("history")}
            >
              Version history{" "}
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
                    }}
                    onNearby={() => setTab("context")}
                  />
                )}
                {(!entrepreneur || !!record.review?.domainRatings?.length) && <PotentialReviewResult record={record} onEvidence={ids => {setSelected(ids);setSourceTab("compare");}} />}
                <section className="panel completion-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Complete missing information</h2>
                      <p>
                        {FIELD_KEYS.length - a.questions.length} of{" "}
                        {FIELD_KEYS.length} parameters answered. Only unanswered
                        or unclear information is shown below.
                      </p>
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
                      Download checklist
                    </button>
                  </div>
                  {a.questions.length ? (
                    <>
                      <div className="completion-tools">
                        <div
                          className="question-filters"
                          role="group"
                          aria-label="Question categories"
                        >
                          {[
                            { key: "all", label: "All", fields: FIELD_KEYS },
                            ...QUESTION_GROUPS,
                          ].map((group) => (
                            <button
                              type="button"
                              aria-pressed={questionGroup === group.key}
                              key={group.key}
                              onClick={() => setQuestionGroup(group.key)}
                            >
                              {group.label}
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
                            aria-label="Search missing information"
                            placeholder="Find a question…"
                            value={questionSearch}
                            onChange={(event) =>
                              setQuestionSearch(event.target.value)
                            }
                          />
                        </div>
                        <span className="hint" role="status">
                          Showing {visibleQuestions.length} of{" "}
                          {a.questions.length} open questions
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
                                {FIELD_LABELS[q.field]}
                              </span>
                              <h3>{q.translatedQuestion ?? q.question}</h3>
                              {q.translatedQuestion && <p>{q.question}</p>}
                              <details className="question-guidance">
                                <summary>Answer guidance</summary>
                                <p>{PARAMETER_QUESTIONS[q.field].hint}</p>
                              </details>
                            </div>
                            <button
                              className="button secondary small"
                              onClick={() => {
                                setRepairField(q.field);
                                setRepair(true);
                              }}
                              aria-label={`Answer ${FIELD_LABELS[q.field]}`}
                            >
                              Answer <ArrowRight size={14} />
                            </button>
                          </article>
                        ))}
                        {!visibleQuestions.length && (
                          <div className="question-empty">
                            <h3>No questions match these filters</h3>
                            <button
                              type="button"
                              className="button secondary small"
                              onClick={() => {
                                setQuestionGroup("all");
                                setQuestionSearch("");
                              }}
                            >
                              Show all open questions
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="notes-body">
                      <p>
                        All parameters have answers in the available evidence.
                        No additional questions are needed.
                      </p>
                    </div>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>The business, at a glance</h2>
                      <p>
                        Applicant-stated facts quoted from the available
                        evidence.
                      </p>
                    </div>
                    <span className="outline-label">SOURCE LINKED</span>
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
                          }}
                        />
                      ))}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Assessment dimensions</h2>
                      <p>
                        Deterministic rubric · 0–4 · unknown is different from
                        zero.
                      </p>
                    </div>
                  </div>
                  <div className="dimension-list">
                    {a.dimensions.map((d) => (
                      <div className="dimension-row" key={d.key}>
                        <div className="dimension-heading">
                          <strong>{d.label}</strong>
                          <span>
                            {d.score == null
                              ? "Not assessable"
                              : `${d.score} / 4`}
                          </span>
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
                        <p>{d.explanation}</p>
                        {d.evidenceIds.length > 0 && (
                          <button
                            className="evidence-link"
                            onClick={() => {
                              setSelected(d.evidenceIds);
                              setSourceTab("compare");
                            }}
                          >
                            View supporting evidence <ArrowUpRight size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="panel-footer">
                    <Info size={14} />
                    Rubric {a.rubricVersion}. Weights are product rules, not
                    learned business-outcome predictions.
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Assessor notes & next steps</h2>
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
                            <strong>Next action: </strong>
                            {record.review.nextAction}
                          </p>
                        )}
                        {record.review.reasonCodes?.length ? (
                          <p className="hint">
                            Reasons:{" "}
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
                            Supporting evidence:{" "}
                            {record.review.evidenceIds.join(", ")}
                          </p>
                        ) : null}
                        <span className="hint">
                          Reviewed{" "}
                          {new Date(
                            record.review.reviewedAt,
                          ).toLocaleDateString("en-IN")}
                        </span>
                      </>
                    ) : (
                      <p className="muted">
                        No assessor review recorded. Review the source and
                        unresolved questions before choosing the next step.
                      </p>
                    )}
                  </div>
                </section>
              </section>
              <aside className="source-column">
                <EvidencePanel record={record} selected={selected} onSelect={setSelected} mode={sourceTab} onModeChange={setSourceTab} onVerify={() => void verify()} busy={busy} readOnly={!!entrepreneur} />
                <section className="panel limits-panel">
                  <div className="panel-heading">
                    <h3>
                      <ShieldCheck size={16} />
                      What to keep in mind
                    </h3>
                  </div>
                  <ul>
                    {a.warnings
                      .filter((v) => !v.startsWith("Synthetic"))
                      .map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    <li>
                      Source references establish traceability. They do not
                      independently verify the applicant’s claims.
                    </li>
                  </ul>
                </section>
              </aside>
            </div>
          ) : tab === "context" ? (
            <div className="context-layout">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Related business ideas</h2>
                    <p>
                      Similarity helps identify overlap; it is not a
                      recommendation or a truth check.
                    </p>
                  </div>
                </div>
                {matches.length ? (
                  <div className="similar-list">
                    {matches.map((m) => (
                      <Link
                        key={m.submission.id}
                        to={`/submissions/${m.submission.id}`}
                        className="similar-card"
                      >
                        <div className="similar-icon">
                          <Icon type={m.submission.inputType} />
                        </div>
                        <div>
                          <h3>{m.submission.title}</h3>
                          <p>
                            {m.submission.beneficiaryName} ·{" "}
                            {m.submission.cohortName ?? "Unassigned cohort"}
                          </p>
                          <div className="match-tags">
                            {m.matchedTerms.map((t) => (
                              <span key={t}>{t}</span>
                            ))}
                          </div>
                          <small>
                            {m.method === "embedding"
                              ? "Semantic similarity"
                              : "Keyword overlap"}
                            {m.method === "embedding"
                              ? ` · ${m.similarity.toFixed(2)} cosine score`
                              : ""}
                          </small>
                        </div>
                        <ArrowUpRight size={17} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="No related ideas found"
                    description="Matches will appear as more distinct business proposals are assessed."
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
                  <h2>Evidence changes. The assessment follows.</h2>
                  <p>Every clarification preserves the earlier assessment.</p>
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
                          Version {version.version}{" "}
                          <span className="small-label">
                            {index === 0 ? "CURRENT" : "PREVIOUS"}
                          </span>
                        </h3>
                        <p>
                          {new Date(version.createdAt).toLocaleString("en-IN")}{" "}
                          · Completeness {version.completeness}% · Assessment{" "}
                          {version.score ?? "not assessable"}
                        </p>
                        {changed.map((f) => (
                          <div className="history-change" key={f.key}>
                            <strong>{FIELD_LABELS[f.key]}</strong>
                            <span>
                              {previous?.fields.find((p) => p.key === f.key)
                                ?.value ?? "Unknown / conflicting"}{" "}
                              <ArrowRight size={13} />{" "}
                              {f.value ?? "Unknown / conflicting"}
                            </span>
                          </div>
                        ))}
                        {!previous && (
                          <small>Initial extraction and assessment.</small>
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
    <Modal title="Evidence Repair Loop" onClose={onClose}>
      <div className="modal-content">
        <div className="repair-intro">
          <span className="document-icon">
            <MessageSquare size={20} />
          </span>
          <p>
            {a.questions.length} parameters still need answers. Information
            already found in your input is not asked again. Answers may change
            the assessment in either direction.
          </p>
        </div>
        {!q ? (
          <Empty
            title="No open questions"
            description="Review the source evidence or add an assessor note."
          />
        ) : (
          <form onSubmit={save}>
            <label>
              Information to clarify
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
                    {FIELD_LABELS[question.field]}
                  </option>
                ))}
              </select>
            </label>
            <div className="question-card">
              <div className="eyebrow">QUESTION FOR THE BENEFICIARY</div>
              <h3>{q.translatedQuestion ?? q.question}</h3>
              {q.translatedQuestion && <p>{q.question}</p>}
              <small>{q.reason}</small>
              <p>{PARAMETER_QUESTIONS[q.field].hint}</p>
            </div>
            <label>
              Answer language
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
                Type an answer
              </button>
              <button
                type="button"
                className={mode === "audio" ? "active" : ""}
                disabled={pending}
                onClick={() => setMode("audio")}
              >
                <Mic size={14} />
                Record an answer
              </button>
            </div>
            {mode === "text" ? (
              <label>
                Your clarification
                <textarea
                  required
                  minLength={1}
                  maxLength={2000}
                  rows={5}
                  value={answer}
                  disabled={pending}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Provide the missing detail or explain which conflicting value is correct."
                />
              </label>
            ) : (
              <Recorder onFile={setFile} disabled={pending} />
            )}
            <p className="hint">
              The original remains unchanged. Your clarification becomes a new
              evidence source and assessment version.
            </p>
            {record.example && (
              <Notice>
                This example is read-only. Connect your workspace to save
                clarifications on live submissions.
              </Notice>
            )}
            {error && <Notice type="error">{error}</Notice>}
            {stale && (
              <Notice>
                This assessment has changed. Close and reopen these questions
                before answering.
              </Notice>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={onClose}
              >
                Close
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
                Save & reassess
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
  const [decision, setDecision] = useState(""),
    [note, setNote] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [nextAction, setNextAction] = useState("");
  const [sourceReviewed, setSourceReviewed] = useState(false);
  const [domainRatings,setDomainRatings]=useState<DomainRating[]>(record.review?.assessmentVersion===record.assessment?.version ? record.review?.domainRatings??[] : []);
  return (
    <Modal title="Record assessor review" onClose={onClose}>
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
          This review records your professional judgement. AI assessment does
          not determine funding eligibility.
        </Notice>
        <label>
          Recommended next step
          <select
            required
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
          >
            <option value="">Select a next step</option>
            <option value="mentoring">Mentoring / skilling conversation</option>
            <option value="deeper_evaluation">Deeper evaluation</option>
            <option value="clarification">Further clarification</option>
            <option value="reviewed">Reviewed — no next step recorded</option>
          </select>
        </label>
        <label>
          Review rationale
          <textarea
            rows={5}
            required
            minLength={20}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain the next step and any information that needs validation."
          />
        </label>
        <fieldset className="review-checklist">
          <legend>Review reasons — choose 1 to 4</legend>
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
              {label}
            </label>
          ))}
        </fieldset>
        <label>
          Next action{" "}
          {decision === "reviewed" && (
            <span className="optional">optional</span>
          )}
          <textarea
            rows={3}
            required={decision !== "reviewed"}
            minLength={decision === "reviewed" ? undefined : 10}
            maxLength={600}
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder="Describe who should do what next, and which information should be checked."
          />
        </label>
        <fieldset className="review-checklist">
          <legend>Supporting source evidence — choose 1 to 20</legend>
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
        <PotentialReviewFields record={record} ratings={domainRatings} onChange={setDomainRatings} disabled={pending} />
        <label className="check-line">
          <input
            type="checkbox"
            checked={sourceReviewed}
            onChange={(event) => setSourceReviewed(event.target.checked)}
            required
          />
          I reviewed the original source and the evidence supporting this
          recommendation.
        </label>
        {error && <Notice type="error">{error}</Notice>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={pending}>
            {pending ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <Check size={15} />
            )}
            Save review
          </button>
        </div>
      </form>
    </Modal>
  );
}
