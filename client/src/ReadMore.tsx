import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Modal } from "./components";
import { t, useLanguage } from "./i18n";
export default function ReadMore({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="read-more-trigger text-link"
        onClick={() => setOpen(true)}
      >
        <Info size={15} />
        {t(title)}
      </button>
      {open && (
        <Modal title={t(title)} onClose={() => setOpen(false)}>
          <div className="read-more-content">{children}</div>
        </Modal>
      )}
    </>
  );
}
