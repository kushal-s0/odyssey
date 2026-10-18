// localized-ui
import { t, useLanguage } from "./i18n";
import { FINANCIAL_FIELDS } from "../../shared/input-rules";

export const EMPTY_GUIDED_INPUT = {
  products: "",
  customers: "",
  problem: "",
  location: "",
  materials: "",
  suppliers: "",
  competition: "",
  differentiation: "",
  experience: "",
  investment: "",
  selfInvestment: "",
  loan: "",
  unitPrice: "",
  monthlyRevenue: "",
  monthlyCosts: "",
  priceUnit: "",
  researchStatus: "unknown",
  researchDetails: "",
};
export type GuidedDraft = typeof EMPTY_GUIDED_INPUT;
const fields = [
  {
    key: "products",
    label: "Products and services",
    max: 1200,
    required: true,
    placeholder: "Describe what you will sell or provide.",
  },
  {
    key: "customers",
    label: "Target customers",
    max: 800,
    placeholder: "Who would buy from you? Leave blank if not decided.",
  },
  {
    key: "problem",
    label: "Customer problem",
    max: 1000,
    placeholder: "What need or problem would the business address?",
  },
  {
    key: "location",
    label: "Business location",
    max: 250,
    placeholder:
      "Village or locality, district and state. No home address needed.",
  },
  {
    key: "materials",
    label: "Materials and equipment",
    max: 1000,
    placeholder: "List the main supplies, equipment or facilities you need.",
  },
  {
    key: "suppliers",
    label: "Suppliers",
    max: 800,
    placeholder: "Where would you obtain your supplies?",
  },
  {
    key: "competition",
    label: "Competition",
    max: 1000,
    placeholder: "Describe similar businesses you know about.",
  },
  {
    key: "differentiation",
    label: "What makes your offer different?",
    max: 1000,
    placeholder:
      "Describe your proposed difference without guessing about competitors.",
  },
  {
    key: "experience",
    label: "Relevant experience",
    max: 800,
    placeholder: "Describe experience or skills relevant to this business.",
  },
] as const;

export default function GuidedIdeaInputs({
  value,
  onChange,
  errors,
}: {
  value: GuidedDraft;
  onChange: (value: GuidedDraft) => void;
  errors: Record<string, string>;
}) {
  useLanguage();
  const update = (key: keyof GuidedDraft, text: string) =>
    onChange({ ...value, [key]: text });
  const error = (key: string) =>
    errors[key] && (
      <small className="field-error" id={`guided-${key}-error`}>
        {errors[key]}
      </small>
    );
  return (
    <div className="guided-input">
      <p className="hint">
        {t(
          "Only products and services are required here. Leave other answers blank when you do not know; unknown amounts are different from zero.",
        )}
      </p>
      <div className="guided-fields">
        <div className="guided-section-heading" id="guided-section-business">
          <span className="eyebrow">{t("01 · BUSINESS & CUSTOMERS")}</span>
          <h3>{t("What will your business do?")}</h3>
          <p>
            {t(
              "Describe the offering, the people it serves, and the need it addresses.",
            )}
          </p>
        </div>
        {fields
          .filter(
            (field) =>
              !["materials", "suppliers", "experience"].includes(field.key),
          )
          .map((field) => (
            <label key={field.key}>
              {t(field.label)}
              {!("required" in field) && (
                <span className="optional"> {t("optional")}</span>
              )}
              <textarea
                id={`guided-${field.key}`}
                rows={field.key === "products" ? 3 : 2}
                value={value[field.key]}
                onChange={(event) => update(field.key, event.target.value)}
                required={"required" in field}
                minLength={"required" in field ? 10 : undefined}
                maxLength={field.max}
                placeholder={t(field.placeholder)}
                aria-invalid={!!errors[field.key]}
                aria-describedby={
                  errors[field.key] ? `guided-${field.key}-error` : undefined
                }
              />
              <small className="hint">
                {value[field.key].length} / {field.max}
              </small>
              {error(field.key)}
            </label>
          ))}
        <div className="guided-section-heading" id="guided-section-operations">
          <span className="eyebrow">{t("02 · OPERATIONS")}</span>
          <h3>{t("How will you deliver it?")}</h3>
          <p>{t("Share the resources, sourcing and skills you know about.")}</p>
        </div>
        {fields
          .filter((field) =>
            ["materials", "suppliers", "experience"].includes(field.key),
          )
          .map((field) => (
            <label key={field.key}>
              {t(field.label)}
              <span className="optional"> {t("optional")}</span>
              <textarea
                id={`guided-${field.key}`}
                rows={2}
                value={value[field.key]}
                onChange={(event) => update(field.key, event.target.value)}
                maxLength={field.max}
                placeholder={t(field.placeholder)}
                aria-invalid={!!errors[field.key]}
                aria-describedby={
                  errors[field.key] ? `guided-${field.key}-error` : undefined
                }
              />
              <small className="hint">
                {value[field.key].length} / {field.max}
              </small>
              {error(field.key)}
            </label>
          ))}
      </div>
      <div className="guided-section-heading" id="guided-section-finances">
        <span className="eyebrow">{t("03 · FINANCES")}</span>
        <h3>{t("Make your assumptions visible.")}</h3>
      </div>
      <p className="hint">
        {t(
          "Amounts are in Indian rupees (INR). Sales and operating costs are monthly projections. Enter 0 only if the amount is genuinely zero.",
        )}
      </p>
      <div className="form-grid">
        {FINANCIAL_FIELDS.map(([key, label]) => (
          <label key={key}>
            {t(label)} (₹{key.startsWith("monthly") ? "/month" : ""}){" "}
            <span className="optional"> {t("optional")}</span>
            <input
              id={`guided-${key}`}
              inputMode="decimal"
              maxLength={24}
              placeholder={t("Not known yet")}
              value={value[key]}
              onChange={(event) => update(key, event.target.value)}
              aria-invalid={!!errors[key]}
              aria-describedby={errors[key] ? `guided-${key}-error` : undefined}
            />
            {error(key)}
          </label>
        ))}
        <label>
          {t("Price unit")}{" "}
          {value.unitPrice.trim() ? (
            <span className="hint">{t("required with a price")}</span>
          ) : (
            <span className="optional"> {t("optional")}</span>
          )}
          <input
            id="guided-priceUnit"
            maxLength={80}
            value={value.priceUnit}
            onChange={(event) => update("priceUnit", event.target.value)}
            placeholder={t("e.g. meal, garment or litre")}
            aria-invalid={!!errors.priceUnit}
            aria-describedby={
              errors.priceUnit ? "guided-priceUnit-error" : undefined
            }
          />
          {error("priceUnit")}
        </label>
      </div>
      <div className="guided-section-heading" id="guided-section-research">
        <span className="eyebrow">{t("04 · MARKET RESEARCH")}</span>
        <h3>{t("What have you checked so far?")}</h3>
      </div>
      <label>
        {t("Research status")}
        <select
          id="guided-researchStatus"
          value={value.researchStatus}
          onChange={(event) => update("researchStatus", event.target.value)}
          aria-invalid={!!errors.researchStatus}
          aria-describedby={
            errors.researchStatus ? "guided-researchStatus-error" : undefined
          }
        >
          <option value="unknown">{t("Not known yet")}</option>
          <option value="not_done">{t("Not conducted")}</option>
          <option value="planned">{t("Planned, not conducted yet")}</option>
          <option value="done">{t("Conducted")}</option>
        </select>
        {error("researchStatus")}
      </label>
      <label>
        {t("Research details")}{" "}
        <span className="optional">
          {value.researchStatus === "done"
            ? t("required for conducted research")
            : t("optional")}
        </span>
        <textarea
          id="guided-researchDetails"
          rows={3}
          maxLength={1200}
          minLength={value.researchStatus === "done" ? 20 : undefined}
          required={value.researchStatus === "done"}
          value={value.researchDetails}
          onChange={(event) => update("researchDetails", event.target.value)}
          placeholder={t(
            "If conducted, describe who you consulted, how and what you learned.",
          )}
          aria-invalid={!!errors.researchDetails}
          aria-describedby={
            errors.researchDetails ? "guided-researchDetails-error" : undefined
          }
        />
        {error("researchDetails")}
      </label>
    </div>
  );
}
