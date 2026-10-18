import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Info, X } from "lucide-react";
import { t } from "./i18n";
// The same large explanation works with a mouse, keyboard, or touch.
export default function HelpTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false),
    [pinned, setPinned] = useState(false),
    id = useId();
  const container = useRef<HTMLSpanElement>(null);
  const close = () => {
    setOpen(false);
    setPinned(false);
  };
  useEffect(() => {
    if (!pinned) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [pinned]);
  return (
    <span
      ref={container}
      className={`friendly-help ${open ? "is-open" : ""}`}
      onMouseEnter={() => {
        if (window.matchMedia("(min-width: 761px) and (hover: hover)").matches)
          setOpen(true);
      }}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
      onFocusCapture={(e) => {
        if ((e.target as HTMLElement).matches(":focus-visible")) setOpen(true);
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          close();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        type="button"
        className="friendly-help-trigger"
        aria-label={t("More about {topic}", { topic: label })}
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={open ? id : undefined}
        onClick={() => {
          setPinned(!pinned);
          setOpen(!pinned);
        }}
      >
        <Info size={17} />
      </button>
      <span className="friendly-help-card" role="note" id={id}>
        <strong>{label}</strong>
        <span>{children}</span>
        {pinned && (
          <button type="button" onClick={close} aria-label={t("Close help")}>
            <X size={15} />
          </button>
        )}
      </span>
    </span>
  );
}
