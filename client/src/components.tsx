// localized-ui
import ReadMore from "./ReadMore";
import { t, useLanguage } from "./i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronRight,
  FileText,
  Mic,
  AlignLeft,
  Check,
  AlertCircle,
  Loader2,
  X,
  Square,
  Play,
  Trash2,
  ArrowRight,
  Info,
} from "lucide-react";
import {
  FIELD_LABELS,
  type Submission,
  type EvidenceField,
} from "../../shared/types";
export function Icon({ type, size = 16 }: { type: string; size?: number }) {
  useLanguage();
  return type === "pdf" ? (
    <FileText size={size} />
  ) : type === "audio" ? (
    <Mic size={size} />
  ) : (
    <AlignLeft size={size} />
  );
}
export function Status({ status }: { status: Submission["status"] }) {
  useLanguage();
  const label = {
    ready: "Ready for review",
    needs_review: "Needs review",
    queued: "In queue",
    processing: "Processing",
    failed: "Needs attention",
  }[status];
  return (
    <span className={`status status-${status}`}>
      <span className="status-dot" />
      {t(label)}
    </span>
  );
}
export function Progress({ value }: { value: number }) {
  useLanguage();
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  useLanguage();
  return (
    <div className="empty">
      <div className="empty-icon">
        <FileText size={25} />
      </div>
      <h3>{t(title)}</h3>
      <p>{t(description)}</p>
      {action}
    </div>
  );
}
export function Notice({
  children,
  type = "info",
}: {
  children: ReactNode;
  type?: "info" | "error";
}) {
  useLanguage();
  return (
    <div
      className={`notice ${type}`}
      role={type === "error" ? "alert" : undefined}
    >
      {type === "error" ? <AlertCircle size={17} /> : <Info size={17} />}
      <div>{typeof children === "string" ? t(children) : children}</div>
    </div>
  );
}
export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  useLanguage();
  return (
    <div className="page-intro">
      <div>
        {eyebrow && <div className="eyebrow">{t(eyebrow)}</div>}
        <h1>{t(title)}</h1>
        <ReadMore title="About this page">
          <p>{t(description)}</p>
        </ReadMore>
      </div>
      {action && <div className="intro-action">{action}</div>}
    </div>
  );
}
export function Busy({ label = "Loading workspace" }: { label?: string }) {
  useLanguage();
  return (
    <div className="busy">
      <Loader2 size={21} className="spin" />
      <span>{t(label)}</span>
    </div>
  );
}
const modalStack:HTMLElement[]=[];
let savedBodyOverflow="";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    if (!modalStack.length) savedBodyOverflow=document.body.style.overflow;
    if(ref.current)modalStack.push(ref.current);
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if(modalStack.at(-1)!==ref.current)return;
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
        )??[]).filter(item=>item.getClientRects().length>0);
        if (!items?.length) return;
        const first = items[0]!,
          last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      const index=modalStack.indexOf(ref.current!);if(index>=0)modalStack.splice(index,1);
      if(!modalStack.length)document.body.style.overflow=savedBodyOverflow;
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t(title)}
        className={`modal ${wide ? "modal-wide" : ""}`}
      >
        <div className="modal-heading">
          <h2>{t(title)}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={t("Close dialog")}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function SubmissionsTable({
  items,
  compact = false,
  personal = false,
}: {
  items: Submission[];
  compact?: boolean;
  personal?: boolean;
}) {
  useLanguage();
  if (!items.length)
    return (
      <Empty
        title={t("No ideas here yet")}
        description={t("Start with a text, PDF, or audio submission.")}
        action={
          <Link to="/submit" className="button primary">
            {t("Submit an idea")} <ArrowRight size={15} />
          </Link>
        }
      />
    );
  return (
    <div className="table-scroll">
      <table className="ideas-table">
        <thead>
          <tr>
            <th>
              {personal
                ? t("My business idea")
                : t("Business idea / beneficiary")}
            </th>
            {!compact && !personal && <th>{t("Trade / cohort")}</th>}
            {personal && <th>{t("My readiness")}</th>}
            <th>{t("Submission")}</th>
            <th>{t("Completeness")}</th>
            <th>{t("Status")}</th>
            <th aria-label={t("Open assessment")} />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <Link to={`/submissions/${item.id}`} className="idea-link">
                  {item.title}
                </Link>
                {!personal && (
                  <div className="cell-secondary">{item.beneficiaryName}</div>
                )}
              </td>
              {!compact && !personal && (
                <td>
                  {item.assessment?.fields.find((f) => f.key === "trade")
                    ?.value ?? "Unassigned"}
                  <div className="cell-secondary">
                    {item.cohortName ?? "No cohort assigned"}
                  </div>
                </td>
              )}
              {personal && (
                <td>
                  {item.assessment?.score == null
                    ? t("Pending")
                    : `${item.assessment.score} / 100`}
                </td>
              )}
              <td>
                <span className="format-label">
                  <Icon type={item.inputType} />
                  {item.inputType === "pdf"
                    ? t("PDF")
                    : item.inputType === "audio"
                      ? t("Audio")
                      : t("Text")}
                </span>
                <div className="cell-secondary">
                  {item.language === "auto"
                    ? t("Detecting language")
                    : item.language}
                </div>
              </td>
              <td>
                <div className="table-progress">
                  <span>
                    {item.assessment ? `${item.assessment.completeness}%` : "—"}
                  </span>
                  <Progress value={item.assessment?.completeness ?? 0} />
                </div>
              </td>
              <td>
                <Status status={item.status} />
              </td>
              <td>
                <Link
                  to={`/submissions/${item.id}`}
                  className="icon-button"
                  aria-label={`Open ${item.title}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function FieldCard({
  field,
  onEvidence,
}: {
  field: EvidenceField;
  onEvidence: (ids: string[]) => void;
}) {
  useLanguage();
  return (
    <div className={`fact fact-${field.status}`}>
      <div className="fact-top">
        <span>{t(FIELD_LABELS[field.key])}</span>
        {field.status === "supported" ? (
          <Check size={13} />
        ) : (
          <span className="small-label">
            {field.status === "ambiguous"
              ? t("Conflicting")
              : field.status === "irrelevant"
                ? t("Off-topic")
                : t("Not provided")}
          </span>
        )}
      </div>
      <p>
        {field.value ??
          (field.status === "ambiguous"
            ? "Conflicting values need confirmation."
            : field.status === "irrelevant"
              ? "The response does not answer this question."
              : "No supporting information supplied.")}
      </p>
      {field.evidenceIds.length > 0 && (
        <button
          className="evidence-link"
          onClick={() => onEvidence(field.evidenceIds)}
        >
          <FileText size={12} />
          {field.evidenceIds.length} {t("source")}{" "}
          {field.evidenceIds.length === 1 ? t("reference") : t("references")}{" "}
          <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}
export function Recorder({
  onFile,
  disabled = false,
}: {
  onFile: (file: File | null) => void;
  disabled?: boolean;
}) {
  useLanguage();
  const [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [file, setFile] = useState<File | null>(null),
    [url, setUrl] = useState<string | null>(null),
    [error, setError] = useState("");
  const media = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    chunks = useRef<Blob[]>([]),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      media.current?.state === "recording" && media.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);
  useEffect(() => {
    if (recording && seconds >= 300) media.current?.stop();
  }, [recording, seconds]);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const object = URL.createObjectURL(file);
    setUrl(object);
    return () => URL.revokeObjectURL(object);
  }, [file]);
  async function start() {
    try {
      setError("");
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Recording requires localhost or HTTPS and a supported browser. You can upload audio instead.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mime = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(
        stream.current,
        mime ? { mimeType: mime } : undefined,
      );
      media.current = recorder;
      chunks.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        if (!mounted.current) return;
        const type = recorder.mimeType;
        const extension = type.includes("mp4")
          ? "m4a"
          : type.includes("ogg")
            ? "ogg"
            : "webm";
        const next = new File(chunks.current, `recording.${extension}`, {
          type,
        });
        setFile(next);
        onFile(next);
        setRecording(false);
      };
      recorder.start(1000);
      setSeconds(0);
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone access failed.");
      stream.current?.getTracks().forEach((t) => t.stop());
    }
  }
  return (
    <div className="recorder">
      {file && url ? (
        <>
          <audio controls src={url} />
          <button
            className="button subtle"
            type="button"
            onClick={() => {
              setFile(null);
              onFile(null);
            }}
            disabled={disabled}
          >
            <Trash2 size={15} />
            {t("Record again")}
          </button>
        </>
      ) : (
        <>
          <div
            className={`record-indicator ${recording ? "is-recording" : ""}`}
          >
            <Mic size={23} />
          </div>
          <h3>
            {recording
              ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
              : t("Tell us about your idea")}
          </h3>
          <p>
            {recording
              ? t("Recording · stop when you are finished")
              : t(
                  "Speak naturally in the language you are most comfortable with.",
                )}
          </p>
          <button
            type="button"
            className={`button ${recording ? "secondary" : "primary"}`}
            disabled={disabled}
            onClick={() => (recording ? media.current?.stop() : void start())}
          >
            {recording ? (
              <>
                <Square size={14} />
                {t("Stop recording")}
              </>
            ) : (
              <>
                <Mic size={15} />
                {t("Start recording")}
              </>
            )}
          </button>
          <span className="hint">
            {t(
              "Up to 5 minutes per recording. Please avoid sharing contact details.",
            )}
          </span>
        </>
      )}
      {error && <Notice type="error">{error}</Notice>}
    </div>
  );
}
