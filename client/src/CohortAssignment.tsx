// localized-ui
import { t, useLanguage } from "./i18n";
import { useState } from "react";
import type { Submission } from "../../shared/types";
import { useWorkspace } from "./workspace";
import { api } from "./api";
import { Notice } from "./components";
export default function CohortAssignment({
  record,
  onSaved,
}: {
  record: Submission;
  onSaved: (record: Submission) => void;
}) {
  useLanguage();
  const w = useWorkspace(),
    [cohort, setCohort] = useState(record.cohortId ?? ""),
    [name, setName] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function save(create = false) {
    setPending(true);
    setError("");
    try {
      let cohortId = cohort || null;
      if (create) {
        const r = await api<{ id: string }>("/cohorts", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        cohortId = r.id;
        setCohort(r.id);
        setName("");
      }
      const r = await api<{ submission: Submission }>(
        `/submissions/${record.id}/cohort`,
        {
          method: "POST",
          body: JSON.stringify({ cohortId, updatedAt: record.updatedAt }),
        },
      );
      onSaved(r.submission);
      await w.refresh();
      w.notify("Programme cohort assignment saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign cohort.");
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="cohort-assignment">
      <summary>{t("Assign programme cohort")}</summary>
      <p className="hint">
        {t(
          "Use the beneficiary's actual programme membership. Cohorts are never inferred from the proposal.",
        )}
      </p>
      <div className="input-button">
        <select
          aria-label={t("Assign programme cohort")}
          value={cohort}
          disabled={pending}
          onChange={(e) => setCohort(e.target.value)}
        >
          <option value="">{t("Unassigned cohort")}</option>
          {w.cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.synthetic ? t(" · demo") : ""}
            </option>
          ))}
        </select>
        <button
          className="button secondary small"
          disabled={pending || cohort === (record.cohortId ?? "")}
          onClick={() => void save()}
        >
          {t("Save cohort")}
        </button>
      </div>
      <div className="input-button">
        <input
          aria-label={t("New programme cohort name")}
          placeholder={t("Or create the actual programme cohort")}
          minLength={2}
          maxLength={100}
          value={name}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="button secondary small"
          disabled={pending || name.trim().length < 2}
          onClick={() => void save(true)}
        >
          {t("Create and assign")}
        </button>
      </div>
      {error && <Notice type="error">{error}</Notice>}
    </details>
  );
}
