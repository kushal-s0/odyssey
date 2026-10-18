// localized-ui
import { t, useLanguage } from "../i18n";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlignLeft,
  FileText,
  Mic,
  Upload,
  ArrowRight,
  Check,
  ShieldCheck,
  File,
  Loader2,
  X,
} from "lucide-react";
import { PageIntro, Notice, Recorder, Modal } from "../components";
import { useWorkspace } from "../workspace";
import { api, download } from "../api";
import { LANGUAGES, type Submission } from "../../../shared/types";
import {
  submissionSchema,
  serializeGuidedIdea,
} from "../../../shared/input-rules";
import InputCompanion from "../InputCompanion";
import GuidedIdeaInputs, { EMPTY_GUIDED_INPUT } from "../GuidedIdeaInputs";
export default function Submit() {
  useLanguage();
  const w = useWorkspace(),
    navigate = useNavigate();
  const [type, setType] = useState<"text" | "pdf" | "audio">("text"),
    [audioMode, setAudioMode] = useState<"record" | "upload">("record"),
    [name, setName] = useState(""),
    [title, setTitle] = useState(""),
    [language, setLanguage] = useState("auto"),
    [cohort, setCohort] = useState(""),
    [text, setText] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [drag, setDrag] = useState(false);
  const [writeMode, setWriteMode] = useState<"guided" | "free_text">(
    "free_text",
  );
  const [guided, setGuided] = useState({ ...EMPTY_GUIDED_INPUT });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{
    text: string;
    title: string;
    name: string;
    language: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const entrepreneur = w.session?.user?.role === "entrepreneur";
  useEffect(() => {
    if (entrepreneur && w.session?.user) setName(w.session.user.name);
  }, [entrepreneur, w.session?.user?.name]);
  const fileRef = useRef<HTMLInputElement>(null);
  const available = w.session?.health.database && w.session?.user;
  const max = w.session?.health.maxUploadMb ?? 10;
  const input = () => ({
    beneficiaryName: name,
    title,
    language,
    inputType: type,
    submissionFormat: type === "text" ? writeMode : "upload",
    ...(cohort && !entrepreneur ? { cohortId: cohort } : {}),
    ...(type === "text"
      ? writeMode === "guided"
        ? { structuredInput: guided }
        : { originalText: text }
      : {}),
  });
  function showIssues(
    issues: { path: (string | number)[]; message: string }[],
  ) {
    setFieldErrors(
      Object.fromEntries(
        issues.map((issue) => [
          issue.path.join(".").replace(/^structuredInput\./, ""),
          issue.message,
        ]),
      ),
    );
    setError([...new Set(issues.map((issue) => issue.message))].join(" "));
    const key = issues[0]?.path.join(".").replace(/^structuredInput\./, "");
    requestAnimationFrame(() =>
      document
        .getElementById(
          key === "title"
            ? "submission-title"
            : key === "beneficiaryName"
              ? "submission-name"
              : `guided-${key}`,
        )
        ?.focus(),
    );
  }
  function previewInput() {
    const parsed = submissionSchema.safeParse(input());
    if (!parsed.success) {
      showIssues(parsed.error.issues);
      return;
    }
    if (type !== "text" && !file) {
      setError("Choose a source file before previewing.");
      return;
    }
    setError("");
    setFieldErrors({});
    setPreview({
      title: parsed.data.title,
      name: parsed.data.beneficiaryName,
      language: parsed.data.language,
      text: parsed.data.structuredInput
        ? serializeGuidedIdea(parsed.data.title, parsed.data.structuredInput)
        : (parsed.data.originalText ??
          `Source file: ${file!.name}\nSize: ${(file!.size / 1024 / 1024).toFixed(2)} MB\n\nThe original file will be read after submission. Its content has not been extracted in this preview.`),
    });
  }
  function chooseFile(selected: File | null) {
    setError("");
    if (selected && selected.size === 0) {
      setError("Choose a file with content.");
      return;
    }
    const extensions =
      type === "pdf" ? /\.pdf$/i : /\.(mp4|m4a|ogg|mp3|wav|webm|flac)$/i;
    if (selected && !extensions.test(selected.name)) {
      setError(
        type === "pdf"
          ? "Choose a PDF document."
          : "Choose an MP4, M4A, OGG, MP3, WAV, WebM or FLAC recording.",
      );
      return;
    }
    if (selected && selected.size > max * 1024 * 1024) {
      setError(`Choose a file smaller than ${max} MB.`);
      return;
    }
    setFile(selected);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError("");
    if (!available) {
      setError(
        "Connect Atlas and sign in to submit an idea to your live workspace.",
      );
      return;
    }
    if (
      type === "audio" &&
      w.session?.health.audioProvider === "cloud" &&
      language === "auto"
    ) {
      setError(t("Select the recording language for cloud speech processing."));
      return;
    }
    if (type !== "text" && !file) {
      setError("Please add a PDF or recording.");
      return;
    }
    const result = submissionSchema.safeParse(input());
    if (!result.success) {
      showIssues(result.error.issues);
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      const data = new FormData();
      data.set("beneficiaryName", result.data.beneficiaryName);
      data.set("title", result.data.title);
      data.set("language", result.data.language);
      data.set("inputType", type);
      data.set("submissionFormat", type === "text" ? writeMode : "upload");
      if (cohort && !entrepreneur) data.set("cohortId", cohort);
      if (type === "text" && writeMode === "guided")
        data.set(
          "structuredInput",
          JSON.stringify(result.data.structuredInput),
        );
      else if (type === "text")
        data.set("originalText", result.data.originalText!);
      else data.set("file", file!);
      const response = await api<{ submission: Submission }>("/submissions", {
        method: "POST",
        body: data,
      });
      await w.refresh();
      w.notify(
        "Idea submitted. Your original is saved and processing has started.",
      );
      navigate(`/submissions/${response.submission.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit the idea.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageIntro
        eyebrow={t("THE NEXT BUSINESS STARTS WITH AN IDEA")}
        title={t("Tell us what you have in mind.")}
        description={t(
          "Write it, say it, or share a document. We’ll help bring the details together.",
        )}
      />
      {!available && (
        <Notice>
          {t("This is an example workspace.")}{" "}
          <Link to="/settings">{t("Connect Atlas and sign in")}</Link>{" "}
          {t("to save and assess your own submissions.")}
        </Notice>
      )}
      <form ref={formRef} onSubmit={submit} className="submit-layout">
        <section className="panel submission-form">
          <div className="form-section">
            <div className="step-heading">
              <span>01</span>
              <div>
                <h2>{t("A few details first")}</h2>
                <p>
                  {t("Keep cohort membership as supplied by your programme.")}
                </p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                {t("Entrepreneur name")}
                <input
                  id="submission-name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder={t("Full name")}
                  value={name}
                  readOnly={entrepreneur}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                {t("Idea title")}
                <input
                  id="submission-title"
                  required
                  minLength={3}
                  maxLength={150}
                  placeholder={t("e.g. A neighbourhood tailoring studio")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                {t("Submission language")}
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {LANGUAGES.map((l) => (
                    <option value={l.code} key={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                {type === "audio" &&
                  w.session?.health.audioProvider === "cloud" && (
                    <small>
                      {t(
                        "Select the recording language for cloud speech processing.",
                      )}
                    </small>
                  )}
              </label>
              {!entrepreneur && (
                <label>
                  {t("Programme cohort")}{" "}
                  <span className="optional">{t("optional")}</span>
                  <select
                    value={cohort}
                    onChange={(e) => setCohort(e.target.value)}
                  >
                    <option value="">{t("Unassigned")}</option>
                    {w.mode === "live" &&
                      w.cohorts.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
          </div>
          <div className="form-section">
            <div className="step-heading">
              <span>02</span>
              <div>
                <h2>{t("Share your business idea")}</h2>
                <p>{t("Choose the format that works best for you.")}</p>
              </div>
            </div>
            <div className="input-tabs">
              {[
                { key: "text", label: "Write an idea", icon: AlignLeft },
                { key: "audio", label: "Record or upload", icon: Mic },
                { key: "pdf", label: "Upload a PDF", icon: FileText },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  className={type === key ? "active" : ""}
                  onClick={() => {
                    setType(key as typeof type);
                    setFile(null);
                    setError("");
                  }}
                >
                  <Icon size={17} />
                  {t(label)}
                </button>
              ))}
            </div>
            {type === "text" ? (
              <>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={writeMode === "guided" ? "active" : ""}
                    onClick={() => {
                      setWriteMode("guided");
                      setError("");
                    }}
                  >
                    {t("Guided form")}
                  </button>
                  <button
                    type="button"
                    className={writeMode === "free_text" ? "active" : ""}
                    onClick={() => {
                      setWriteMode("free_text");
                      setError("");
                    }}
                  >
                    {t("Free text")}
                  </button>
                </div>
                {writeMode === "guided" ? (
                  <GuidedIdeaInputs
                    value={guided}
                    onChange={(value) => {
                      setGuided(value);
                      setFieldErrors({});
                      setError("");
                    }}
                    errors={fieldErrors}
                  />
                ) : (
                  <>
                    <label className="text-input-label" htmlFor="idea-text">
                      {t("Your idea, in your own words")}
                    </label>
                    <textarea
                      id="idea-text"
                      className="idea-textarea"
                      required
                      minLength={20}
                      maxLength={20000}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={t(
                        "What would your business offer? Who are your customers? Where would it operate? Share what you know about costs, prices, suppliers, and competition. It’s okay if you don’t have every answer yet.",
                      )}
                    />
                    <div className="textarea-foot">
                      <span>
                        {t("You can write in any of the supported languages.")}
                      </span>
                      <span>{text.length.toLocaleString()} / 20,000</span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {type === "audio" && (
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={audioMode === "record" ? "active" : ""}
                      onClick={() => {
                        setAudioMode("record");
                        setFile(null);
                      }}
                    >
                      {t("Record audio")}
                    </button>
                    <button
                      type="button"
                      className={audioMode === "upload" ? "active" : ""}
                      onClick={() => {
                        setAudioMode("upload");
                        setFile(null);
                      }}
                    >
                      {t("Upload recording")}
                    </button>
                  </div>
                )}
                {type === "audio" && audioMode === "record" ? (
                  <Recorder onFile={chooseFile} disabled={pending} />
                ) : (
                  <div
                    className={`dropzone ${drag ? "dragging" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDrag(true);
                    }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDrag(false);
                      if (e.dataTransfer.files.length !== 1) {
                        setError("Choose one source file per submission.");
                        return;
                      }
                      chooseFile(e.dataTransfer.files[0] ?? null);
                    }}
                  >
                    {file ? (
                      <>
                        <div className="dropzone-icon">
                          <FileText size={28} />
                        </div>
                        <h3>{file.name}</h3>
                        <p>
                          {(file.size / 1024 / 1024).toFixed(2)}{" "}
                          {t("MB · ready to upload")}
                        </p>
                        <button
                          type="button"
                          className="button secondary small"
                          onClick={() => setFile(null)}
                        >
                          <X size={14} />
                          {t("Remove file")}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="dropzone-icon">
                          <Upload size={25} />
                        </div>
                        <h3>
                          {t("Drop your")}{" "}
                          {type === "pdf" ? t("document") : t("recording")}{" "}
                          {t("here")}
                        </h3>
                        <p>{t("or choose a file from your device")}</p>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => fileRef.current?.click()}
                        >
                          {t("Browse files")}
                        </button>
                        <span className="hint">
                          {type === "pdf"
                            ? `PDF · up to 25 pages · ${max} MB`
                            : `MP4, M4A, OGG, MP3, WAV, WebM or FLAC · ${max} MB · up to 20 minutes`}
                        </span>
                      </>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      className="sr-only"
                      aria-label={t("Choose submission file")}
                      accept={
                        type === "pdf"
                          ? ".pdf"
                          : "audio/*,video/mp4,.ogg,.m4a,.webm"
                      }
                      onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <div className="form-submit-bar">
            <span>
              <ShieldCheck size={15} />
              {t("Your original submission is preserved.")}
            </span>
            <button
              className="button secondary"
              type="button"
              disabled={pending}
              onClick={previewInput}
            >
              {t("Preview submission")}
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={pending || !available}
            >
              {pending ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              {t("Submit for assessment")}{" "}
            </button>
          </div>
          {error && (
            <div className="form-error" role="alert">
              <Notice type="error">{error}</Notice>
            </div>
          )}
        </section>
        <aside className="submit-aside">
          {type === "text" && writeMode === "guided" ? (
            <InputCompanion value={guided} onPreview={previewInput} />
          ) : (
            <>
              <div className="eyebrow">{t("WHAT HAPPENS NEXT")}</div>
              <h2>{t("An idea is a starting point.")}</h2>
              <p>
                {t(
                  "You don’t need a polished business plan. Share what you know, and we’ll help identify what needs a closer look.",
                )}
              </p>
              <ol className="process-list">
                <li>
                  <span>1</span>
                  <div>
                    <strong>{t("Understand your submission")}</strong>
                    <p>
                      {t(
                        "Read or transcribe your original and translate it into English.",
                      )}
                    </p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>{t("Bring the details together")}</strong>
                    <p>
                      {t(
                        "Organise the business, customers, resources, and financial assumptions.",
                      )}
                    </p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>{t("Ask useful questions")}</strong>
                    <p>
                      {t(
                        "Clarify gaps and conflicting answers without filling them in for you.",
                      )}
                    </p>
                  </div>
                </li>
                <li>
                  <span>4</span>
                  <div>
                    <strong>{t("Support the assessor")}</strong>
                    <p>
                      {t(
                        "Provide a consistent first review for the programme team.",
                      )}
                    </p>
                  </div>
                </li>
              </ol>
              <div className="aside-note">
                <ShieldCheck size={20} />
                <p>
                  {t(
                    "This is a first assessment. It does not predict business success or determine funding eligibility.",
                  )}
                </p>
              </div>
            </>
          )}
        </aside>
      </form>
      {preview && (
        <Modal
          title={t("Review your submission")}
          onClose={() => setPreview(null)}
          wide
        >
          <div className="modal-content submission-preview">
            <span className="eyebrow">{t("STANDARDIZED INPUT")}</span>
            <h3>{preview.title}</h3>
            <p>
              {preview.name} ·{" "}
              {LANGUAGES.find((item) => item.code === preview.language)
                ?.label ?? preview.language}
            </p>
            <p className="hint">
              {t(
                "Review the text prepared from your entries before submitting. Blank answers stay unknown. You can continue editing if anything needs to change.",
              )}
            </p>
            <pre>{preview.text}</pre>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  download(
                    "strive-input-summary.txt",
                    `${preview.title}\n\n${preview.text}`,
                  )
                }
              >
                {t("Download summary")}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setPreview(null)}
              >
                {t("Continue editing")}
              </button>
              <button
                type="button"
                className="button primary"
                disabled={pending || !available}
                onClick={() => {
                  setPreview(null);
                  formRef.current?.requestSubmit();
                }}
              >
                {t("Submit for assessment")} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
