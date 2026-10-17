import { useState, useRef, type FormEvent } from "react";
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
import { PageIntro, Notice, Recorder } from "../components";
import { useWorkspace } from "../workspace";
import { api } from "../api";
import { LANGUAGES, type Submission } from "../../../shared/types";
export default function Submit() {
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
  const fileRef = useRef<HTMLInputElement>(null);
  const available = w.session?.health.database && w.session?.user;
  const max = w.session?.health.maxUploadMb ?? 10;
  function chooseFile(selected: File | null) {
    setError("");
    if (selected && selected.size > max * 1024 * 1024) {
      setError(`Choose a file smaller than ${max} MB.`);
      return;
    }
    setFile(selected);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!available) {
      setError(
        "Connect Atlas and sign in to submit an idea to your live workspace.",
      );
      return;
    }
    if (type !== "text" && !file) {
      setError("Please add a PDF or recording.");
      return;
    }
    setPending(true);
    try {
      const data = new FormData();
      data.set("beneficiaryName", name);
      data.set("title", title);
      data.set("language", language);
      data.set("inputType", type);
      if (cohort) data.set("cohortId", cohort);
      if (type === "text") data.set("originalText", text);
      else data.set("file", file!);
      const response = await api<{ submission: Submission }>("/submissions", {
        method: "POST",
        body: data,
      });
      w.setMode("live");
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
        eyebrow="THE NEXT BUSINESS STARTS WITH AN IDEA"
        title="Tell us what you have in mind."
        description="Write it, say it, or share a document. We’ll help bring the details together."
      />
      {!available && (
        <Notice>
          This is an example workspace.{" "}
          <Link to="/settings">Connect Atlas and sign in</Link> to save and
          assess your own submissions.
        </Notice>
      )}
      <form onSubmit={submit} className="submit-layout">
        <section className="panel submission-form">
          <div className="form-section">
            <div className="step-heading">
              <span>01</span>
              <div>
                <h2>A few details first</h2>
                <p>Keep cohort membership as supplied by your programme.</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Beneficiary name
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Idea title
                <input
                  required
                  minLength={3}
                  maxLength={150}
                  placeholder="e.g. A neighbourhood tailoring studio"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Submission language
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
              </label>
              <label>
                Programme cohort <span className="optional">optional</span>
                <select
                  value={cohort}
                  onChange={(e) => setCohort(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {w.mode === "live" &&
                    w.cohorts.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>
          <div className="form-section">
            <div className="step-heading">
              <span>02</span>
              <div>
                <h2>Share your business idea</h2>
                <p>Choose the format that works best for you.</p>
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
                  {label}
                </button>
              ))}
            </div>
            {type === "text" ? (
              <>
                <label className="text-input-label" htmlFor="idea-text">
                  Your idea, in your own words
                </label>
                <textarea
                  id="idea-text"
                  className="idea-textarea"
                  required
                  minLength={20}
                  maxLength={20000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What would your business offer? Who are your customers? Where would it operate? Share what you know about costs, prices, suppliers, and competition. It’s okay if you don’t have every answer yet."
                />
                <div className="textarea-foot">
                  <span>You can write in any of the supported languages.</span>
                  <span>{text.length.toLocaleString()} / 20,000</span>
                </div>
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
                      Record audio
                    </button>
                    <button
                      type="button"
                      className={audioMode === "upload" ? "active" : ""}
                      onClick={() => {
                        setAudioMode("upload");
                        setFile(null);
                      }}
                    >
                      Upload recording
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
                          {(file.size / 1024 / 1024).toFixed(2)} MB · ready to
                          upload
                        </p>
                        <button
                          type="button"
                          className="button secondary small"
                          onClick={() => setFile(null)}
                        >
                          <X size={14} />
                          Remove file
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="dropzone-icon">
                          <Upload size={25} />
                        </div>
                        <h3>
                          Drop your {type === "pdf" ? "document" : "recording"}{" "}
                          here
                        </h3>
                        <p>or choose a file from your device</p>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => fileRef.current?.click()}
                        >
                          Browse files
                        </button>
                        <span className="hint">
                          {type === "pdf"
                            ? `PDF · up to 25 pages · ${max} MB`
                            : `MP4, M4A, OGG, MP3, WAV or WebM · ${max} MB · up to 20 minutes`}
                        </span>
                      </>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      className="sr-only"
                      aria-label="Choose submission file"
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
              Your original submission is preserved.
            </span>
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
              Submit for assessment
            </button>
          </div>
          {error && (
            <div className="form-error">
              <Notice type="error">{error}</Notice>
            </div>
          )}
        </section>
        <aside className="submit-aside">
          <div className="eyebrow">WHAT HAPPENS NEXT</div>
          <h2>An idea is a starting point.</h2>
          <p>
            You don’t need a polished business plan. Share what you know, and
            we’ll help identify what needs a closer look.
          </p>
          <ol className="process-list">
            <li>
              <span>1</span>
              <div>
                <strong>Understand your submission</strong>
                <p>
                  Read or transcribe your original and translate it into
                  English.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Bring the details together</strong>
                <p>
                  Organise the business, customers, resources, and financial
                  assumptions.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Ask useful questions</strong>
                <p>
                  Clarify gaps and conflicting answers without filling them in
                  for you.
                </p>
              </div>
            </li>
            <li>
              <span>4</span>
              <div>
                <strong>Support the assessor</strong>
                <p>Provide a consistent first review for the programme team.</p>
              </div>
            </li>
          </ol>
          <div className="aside-note">
            <ShieldCheck size={20} />
            <p>
              This is a first assessment. It does not predict business success
              or determine funding eligibility.
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}
