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
} from "lucide-react";
import {
  FIELD_LABELS,
  LANGUAGES,
  type Submission,
  type Assessment,
  type RepairQuestion,
  type SimilarIdea,
  type LocalInsights,
  type EvidenceField,
} from "../../../shared/types";
import { useWorkspace } from "../workspace";
import { api } from "../api";
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
    [sourceTab, setSourceTab] = useState("translation"),
    [selected, setSelected] = useState<string[]>([]),
    [repair, setRepair] = useState(false),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [matches, setMatches] = useState<SimilarIdea[]>([]);
  const sourceRef = useRef<HTMLDivElement>(null);
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
    if (!record || !["queued", "processing", "needs_review"].includes(record.status)) return;
    const timer = setInterval(() => void reload(), record.status === "needs_review" ? 15000 : 3500);
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
              <span className="eyebrow">PROVISIONAL ASSESSMENT</span>
              <div className="score-number">
                {a.score ?? "—"}
                <span>{a.score == null ? "Not assessable" : "/ 100"}</span>
              </div>
              <p>Supporting information, not predicted success.</p>
            </div>
            <div className="summary-measure">
              <div>
                <span>Information completeness</span>
                <strong>{a.completeness}%</strong>
              </div>
              <Progress value={a.completeness} />
              <p>{a.gaps.length} information areas need clarification</p>
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
                            setSourceTab("translation");
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
                              setSourceTab("translation");
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
                <section className="panel source-panel" ref={sourceRef}>
                  <div className="panel-heading">
                    <div>
                      <h2>
                        <FileText size={17} />
                        Source evidence
                      </h2>
                      <p>{a.segments.length} segments · original retained</p>
                    </div>
                  </div>
                  <div className="source-tabs">
                    <button
                      className={sourceTab === "translation" ? "active" : ""}
                      onClick={() => setSourceTab("translation")}
                    >
                      English
                    </button>
                    <button
                      className={sourceTab === "original" ? "active" : ""}
                      onClick={() => setSourceTab("original")}
                    >
                      Original language
                    </button>
                    {record.fileName && !record.example && (
                      <button
                        className={sourceTab === "file" ? "active" : ""}
                        onClick={() => setSourceTab("file")}
                      >
                        Source file
                      </button>
                    )}
                    {record.inputType === "text" && (
                      <button
                        className={sourceTab === "raw" ? "active" : ""}
                        onClick={() => setSourceTab("raw")}
                      >
                        Submitted text
                      </button>
                    )}
                  </div>
                  {sourceTab === "raw" ? (
                    <div className="raw-source">{record.originalText}</div>
                  ) : sourceTab === "file" ? (
                    <div className="original-file">
                      {record.inputType === "pdf" ? (
                        <iframe
                          title="Original submitted PDF"
                          src={`/api/submissions/${record.id}/source#page=${a.segments.find((s) => s.id === selected[0])?.page ?? 1}`}
                        />
                      ) : (
                        <audio
                          ref={audioRef}
                          controls
                          src={`/api/submissions/${record.id}/source`}
                        />
                      )}
                      <a
                        className="text-link"
                        href={`/api/submissions/${record.id}/source`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open original file <ExternalLink size={13} />
                      </a>
                    </div>
                  ) : (
                    <div className="source-segments">
                      {a.segments.map((s, index) => (
                        <article
                          id={`source-${s.id}`}
                          className={`source-segment ${selected.includes(s.id) ? "selected" : ""}`}
                          key={s.id}
                        >
                          <div className="source-segment-meta">
                            <span>
                              {s.page
                                ? `PAGE ${s.page}`
                                : s.startSeconds != null
                                  ? `${Math.floor(s.startSeconds / 60)}:${String(Math.floor(s.startSeconds % 60)).padStart(2, "0")}`
                                  : `SEGMENT ${index + 1}`}
                              {s.kind === "clarification"
                                ? " · CLARIFICATION"
                                : ""}
                            </span>
                            <span>
                              {s.verified ? (
                                <>
                                  <Check size={11} />
                                  Checked
                                </>
                              ) : (
                                "Needs verification"
                              )}
                            </span>
                          </div>
                          <p lang={sourceTab === "original" ? undefined : "en"}>
                            {sourceTab === "original"
                              ? s.originalText
                              : s.englishText}
                          </p>
                          {s.clarificationId && !record.example && (
                            <a
                              className="evidence-link"
                              target="_blank"
                              rel="noreferrer"
                              href={`/api/submissions/${record.id}/clarifications/${s.clarificationId}/source`}
                            >
                              Original clarification <ExternalLink size={11} />
                            </a>
                          )}
                          <button
                            className="evidence-link"
                            onClick={() => setSelected([s.id])}
                          >
                            {s.id}
                            <ArrowUpRight size={11} />
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                  {!record.example && !entrepreneur && (
                    <div className="source-verify">
                      <p>
                        Only confirm after comparing the transcript or
                        translation with the original.
                      </p>
                      <button
                        className="button secondary small"
                        disabled={busy}
                        onClick={() => void verify()}
                      >
                        {busy ? (
                          <Loader2 size={14} className="spin" />
                        ) : (
                          <CheckCheck size={14} />
                        )}
                        Confirm{" "}
                        {selected.length ? "selected evidence" : "all evidence"}
                      </button>
                    </div>
                  )}
                </section>
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
          onClose={() => setRepair(false)}
          onSaved={(updated) => {
            setRecord(updated);
            setRepair(false);
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
  onClose,
  onSaved,
}: {
  record: Submission;
  onClose: () => void;
  onSaved: (s: Submission) => void;
}) {
  const a = record.assessment!;
  const [questionId, setQuestionId] = useState(a.questions[0]?.id ?? ""),
    [answer, setAnswer] = useState(""),
    [mode, setMode] = useState("text"),
    [file, setFile] = useState<File | null>(null),
    [language, setLanguage] = useState("auto"),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const q = a.questions.find((q) => q.id === questionId);
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
            A few useful questions can make this proposal easier to understand.
            Answers may change the assessment in either direction.
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
                value={questionId}
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
            </div>
            <label>
              Answer language
              <select
                value={language}
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
                onClick={() => setMode("text")}
              >
                <AlignLeft size={14} />
                Type an answer
              </button>
              <button
                type="button"
                className={mode === "audio" ? "active" : ""}
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
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  value={answer}
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
                disabled={pending || record.example}
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
function LocationPanel({
  example,
  location,
}: {
  example: boolean;
  location: string;
}) {
  const [query, setQuery] = useState(location),
    [locations, setLocations] = useState<
      { id: string; name: string; lat: number; lon: number }[]
    >([]),
    [selected, setSelected] = useState(""),
    [category, setCategory] = useState("tailoring"),
    [radius, setRadius] = useState(3000),
    [result, setResult] = useState<LocalInsights | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  async function search() {
    setPending(true);
    setError("");
    setResult(null);
    try {
      const r = await api<{ locations: typeof locations }>(
        `/locations/search?q=${encodeURIComponent(query)}`,
      );
      setLocations(r.locations);
      setSelected("");
      if (!r.locations.length)
        setError(
          "No matching location found. Try including the district and state.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Location lookup failed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel location-panel">
      <div className="panel-heading">
        <div>
          <h2>
            <MapPin size={17} />
            Local business context
          </h2>
          <p>Confirm the location before looking up mapped businesses.</p>
        </div>
      </div>
      <div className="location-body">
        <Notice>
          Mapped listings are incomplete. They do not measure market demand,
          profitability, or all competitors.
        </Notice>
        <label>
          Business location
          <div className="input-button">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Village, district and state"
            />
            <button
              className="button secondary"
              disabled={example || pending || query.length < 3}
              onClick={() => void search()}
            >
              Find location
            </button>
          </div>
        </label>
        {locations.length > 0 && (
          <label>
            Confirm the correct location
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose the correct place</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="form-grid">
          <label>
            Business category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                ["tailoring", "Tailoring"],
                ["food", "Food service"],
                ["dairy", "Dairy"],
                ["beauty", "Beauty"],
                ["repair", "Phone repair"],
                ["agriculture", "Agricultural inputs"],
                ["poultry", "Poultry / farm products"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search radius
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            >
              <option value={1000}>1 km</option>
              <option value={3000}>3 km</option>
              <option value={5000}>5 km</option>
            </select>
          </label>
        </div>
        <button
          className="button primary"
          disabled={example || pending || !selected}
          onClick={async () => {
            const place = locations.find((l) => l.id === selected);
            if (!place) return;
            setPending(true);
            setError("");
            try {
              setResult(
                await api<LocalInsights>("/locations/businesses", {
                  method: "POST",
                  body: JSON.stringify({
                    lat: place.lat,
                    lon: place.lon,
                    category,
                    radius,
                  }),
                }),
              );
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Business lookup unavailable.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? (
            <Loader2 size={15} className="spin" />
          ) : (
            <MapPin size={15} />
          )}
          Look up mapped businesses
        </button>
        {example && (
          <p className="hint">
            Live location requests are available in your connected workspace. No
            competitor listings have been invented for this example.
          </p>
        )}
        {error && <Notice type="error">{error}</Notice>}
        {result && (
          <div className="local-results">
            <p>{result.message}</p>
            {result.businesses.map((b) => (
              <a
                className="business-result"
                key={b.id}
                href={b.url}
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  <strong>{b.name}</strong>
                  <small>
                    {b.category} · {(b.distanceMeters / 1000).toFixed(1)} km
                  </small>
                </span>
                <ExternalLink size={14} />
              </a>
            ))}
            <small>
              {result.attribution} · Retrieved{" "}
              {new Date(result.retrievedAt).toLocaleString("en-IN")}
            </small>
          </div>
        )}
      </div>
    </section>
  );
}
