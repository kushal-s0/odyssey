import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
import { t, useLanguage } from "./i18n";
export default function HelpTip({
  label,
  children,
  trigger,
}: {
  label: string;
  children: ReactNode;
  trigger?: ReactNode;
}) {
  useLanguage();
  const [open, setOpen] = useState(false),
    [pinned, setPinned] = useState(false),
    [position, setPosition] = useState({ left: 16, top: 60 });
  const id = useId(),
    container = useRef<HTMLSpanElement>(null),
    card = useRef<HTMLSpanElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = () => {
    clearTimeout(timer.current);
  };
  const close = () => {
    cancel();
    setOpen(false);
    setPinned(false);
  };
  const show = () => {
    document.dispatchEvent(new CustomEvent("strive:show-help",{detail:id}));
    setOpen(true);
  };
  useEffect(()=>{
    const other=(event:Event)=>{if((event as CustomEvent).detail!==id)close();};
    document.addEventListener("strive:show-help",other);
    return()=>document.removeEventListener("strive:show-help",other);
  },[id]);
  const leave = () => {
    cancel();
    if (!pinned) timer.current = setTimeout(() => setOpen(false), 130);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const box = container.current?.getBoundingClientRect(),
        tip = card.current;
      if (!box || !tip) return;
      const mobile = innerWidth <= 760,
        width = mobile ? innerWidth - 36 : Math.min(360, innerWidth - 32),
        height = tip.getBoundingClientRect().height;
      const left = mobile
        ? 18
        : Math.min(innerWidth - width - 16, Math.max(16, box.right - width));
      const top = mobile
        ? Math.max(16, innerHeight - height - 22)
        : box.bottom + 10 + height <= innerHeight - 16
          ? box.bottom + 10
          : Math.max(16, box.top - height - 10);
      setPosition({ left, top });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, label, children]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (
        !container.current?.contains(e.target as Node) &&
        !card.current?.contains(e.target as Node)
      )
        close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const focus = (e: React.FocusEvent) => {
    if ((e.target as HTMLElement).matches(":focus-visible")) {
      cancel();
      show();
    }
  };
  const blur = (e: React.FocusEvent) => {
    if (
      !container.current?.contains(e.relatedTarget as Node) &&
      !card.current?.contains(e.relatedTarget as Node)
    )
      close();
  };
  const escape = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };
  return (
    <span
      ref={container}
      className={`friendly-help ${open ? "is-open" : ""} ${trigger !== undefined ? "value-help" : ""}`}
      onMouseEnter={() => {
        if (matchMedia("(min-width:761px) and (hover:hover)").matches) {
          cancel();
          show();
        }
      }}
      onMouseLeave={leave}
      onFocusCapture={focus}
      onBlurCapture={blur}
      onKeyDown={escape}
    >
      <button
        type="button"
        className={
          trigger !== undefined ? "value-help-trigger" : "friendly-help-trigger"
        }
        aria-label={t("More about {topic}", { topic: label })}
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={open ? id : undefined}
        onClick={() => {
          cancel();
          if(pinned)close();else{show();setPinned(true);}
        }}
      >
        {trigger !== undefined ? trigger : <Info size={17} />}
      </button>
      {open &&
        createPortal(
          <span
            ref={card}
            className="friendly-help-card friendly-help-portal"
            role="note"
            id={id}
            style={position}
            onMouseEnter={cancel}
            onMouseLeave={leave}
            onFocusCapture={cancel}
            onBlurCapture={blur}
            onKeyDown={escape}
          >
            <strong>{label}</strong>
            <span>{children}</span>
            {pinned && (
              <button
                type="button"
                aria-label={t("Close help")}
                onClick={close}
              >
                <X size={15} />
              </button>
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}
