"use client";

import { MissionInputSchemaV1 } from "@cluvvi/core/mission";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeMissionPrompt, createMissionName } from "@/lib/customer-mission-composer";

interface CustomerMissionComposerProps {
  runnerAvailable: boolean;
}

type SubmitStep = "idle" | "creating" | "opening";

function submitLabel(step: SubmitStep): string {
  if (step === "creating") return "Starting run…";
  if (step === "opening") return "Opening run…";
  return "Start finding customers →";
}

type FieldErrors = Record<string, string[]>;
type OptionalField =
  | "website"
  | "price"
  | "exclusions"
  | "goodCustomerExamples"
  | "badCustomerExamples"
  | "additionalContext";

const EXAMPLE_PROMPTS = [
  "Find companies currently hiring video editors",
  "Find podcast agencies increasing production",
  "Find teams struggling with editing turnaround",
] as const;

const GEOGRAPHY_OPTIONS = [
  "Global",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "United Arab Emirates",
  "Europe",
  "Custom",
] as const;

const OPPORTUNITY_OPTIONS = ["10", "20", "30", "50", "Custom"] as const;

const OPTIONAL_FIELD_LABELS: Array<{ field: OptionalField; label: string }> = [
  { field: "website", label: "Add product website" },
  { field: "price", label: "Add price" },
  { field: "exclusions", label: "Add exclusions" },
  { field: "goodCustomerExamples", label: "Add good-customer examples" },
  { field: "badCustomerExamples", label: "Add bad-customer examples" },
  { field: "additionalContext", label: "Add additional context" },
];

function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? "").trim();
  return text.length === 0 ? undefined : Number(text);
}

function errorTarget(key: string): string {
  if (key.startsWith("price.")) return "price-section";
  return `${key}-field`;
}

function friendlyValidationMessage(key: string, fallback: string): string {
  if (key === "description") return "Describe what you sell using at least 20 characters.";
  if (key === "website") return "Enter a valid product website.";
  if (key === "desiredOpportunities") return "Choose between 1 and 100 opportunities.";
  if (key === "geographies") return "Choose at least one customer geography.";
  if (key.startsWith("price.")) return "Enter a valid non-negative price.";
  return fallback;
}

function OptionalFieldHeader({
  label,
  htmlFor,
  onRemove,
}: {
  label: string;
  htmlFor: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      <button
        type="button"
        className="min-h-11 rounded-lg px-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  );
}

export function CustomerMissionComposer({ runnerAvailable }: CustomerMissionComposerProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const fieldRefs = useRef<Partial<Record<OptionalField, HTMLElement | null>>>({});
  const idempotencyKey = useRef<string | null>(null);
  const submissionInFlight = useRef(false);
  const [prompt, setPrompt] = useState("");
  const [website, setWebsite] = useState("");
  const [urlOnlyDescription, setUrlOnlyDescription] = useState("");
  const [geography, setGeography] = useState<(typeof GEOGRAPHY_OPTIONS)[number]>("Global");
  const [opportunityCount, setOpportunityCount] =
    useState<(typeof OPPORTUNITY_OPTIONS)[number]>("20");
  const [plusOpen, setPlusOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Set<OptionalField>>(new Set());
  const [hiddenFields, setHiddenFields] = useState<Set<OptionalField>>(new Set());
  const [submitStep, setSubmitStep] = useState<SubmitStep>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const promptAnalysis = useMemo(() => analyzeMissionPrompt(prompt), [prompt]);
  const submitting = submitStep !== "idle";

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !plusOpen) return;
      setPlusOpen(false);
      plusButtonRef.current?.focus();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [plusOpen]);

  function fieldVisible(field: OptionalField): boolean {
    return !hiddenFields.has(field) && (advancedOpen || visibleFields.has(field));
  }

  function showField(field: OptionalField) {
    setVisibleFields((current) => new Set(current).add(field));
    setHiddenFields((current) => {
      const next = new Set(current);
      next.delete(field);
      return next;
    });
    setPlusOpen(false);
    requestAnimationFrame(() => fieldRefs.current[field]?.focus());
  }

  function removeField(field: OptionalField, controlNames: string[]) {
    const form = formRef.current;
    for (const name of controlNames) {
      const control = form?.elements.namedItem(name);
      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
        control.value = "";
      }
    }
    if (field === "website") setWebsite("");
    setHiddenFields((current) => new Set(current).add(field));
    setVisibleFields((current) => {
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  }

  function applyDetectedWebsite() {
    if (website.length === 0 && promptAnalysis.websiteSuggestion !== undefined) {
      setWebsite(promptAnalysis.websiteSuggestion);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current) return;

    const form = new FormData(event.currentTarget);
    const analysis = analyzeMissionPrompt(prompt);
    const description =
      analysis.kind === "url_only" ? urlOnlyDescription.trim() : analysis.original.trim();
    const detectedWebsite = analysis.websiteSuggestion;
    const resolvedWebsite = website.trim() || detectedWebsite || "";

    if (analysis.kind === "empty") {
      setErrors({ description: ["Describe what you sell or paste your website."] });
      return;
    }
    if (analysis.kind === "url_only" && description.length < 20) {
      setErrors({
        description: ["Briefly describe what this product sells using at least 20 characters."],
      });
      requestAnimationFrame(() => document.getElementById("description-follow-up-field")?.focus());
      return;
    }

    const minimum = optionalNumber(form.get("priceMinimum"));
    const maximum = optionalNumber(form.get("priceMaximum"));
    const customerOutcome = String(form.get("customerOutcome") ?? "").trim();
    const capacityNotes = String(form.get("capacityNotes") ?? "").trim();
    const additionalContext = String(form.get("additionalContext") ?? "").trim();
    const nameInput = String(form.get("name") ?? "").trim();
    const customGeographies = lines(form.get("customGeographies"));
    const desiredOpportunities =
      opportunityCount === "Custom"
        ? Number(form.get("customOpportunityCount") ?? 20)
        : Number(opportunityCount);

    const mission = {
      schemaVersion: "1.0" as const,
      name: nameInput || createMissionName(description),
      ...(resolvedWebsite.length === 0 ? {} : { website: resolvedWebsite }),
      description,
      ...(customerOutcome.length === 0 ? {} : { customerOutcome }),
      ...(minimum === undefined && maximum === undefined
        ? {}
        : {
            price: {
              ...(minimum === undefined ? {} : { minimum }),
              ...(maximum === undefined ? {} : { maximum }),
              currency: String(form.get("currency") ?? "USD"),
              billingPeriod: String(form.get("billingPeriod") ?? "unknown"),
            },
          }),
      geographies: geography === "Custom" ? customGeographies : [geography],
      desiredOpportunities,
      exclusions: lines(form.get("exclusions")),
      goodCustomerExamples: lines(form.get("goodCustomerExamples")),
      badCustomerExamples: lines(form.get("badCustomerExamples")),
      ...(capacityNotes.length === 0 ? {} : { capacityNotes }),
      ...(additionalContext.length === 0 ? {} : { additionalContext }),
    };

    const parsed = MissionInputSchemaV1.safeParse(mission);
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "request";
        nextErrors[key] ??= [];
        nextErrors[key].push(friendlyValidationMessage(key, issue.message));
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setRequestError(null);
    submissionInFlight.current = true;
    setSubmitStep("creating");
    idempotencyKey.current ??= `web_${crypto.randomUUID()}`;
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as {
        run?: { id: string };
        links?: { page: string };
        error?: { message: string; fieldErrors?: FieldErrors };
      };
      if (!response.ok || body.run === undefined || body.links === undefined) {
        setErrors(body.error?.fieldErrors ?? {});
        setRequestError(body.error?.message ?? "Cluvvi could not create this run.");
        submissionInFlight.current = false;
        setSubmitStep("idle");
        return;
      }
      const runPage = body.links.page;
      setSubmitStep("opening");
      requestAnimationFrame(() => router.push(runPage));
    } catch {
      setRequestError("The local web server could not be reached. Your values are still here.");
      submissionInFlight.current = false;
      setSubmitStep("idle");
    }
  }

  const errorFor = (name: string) => errors[name]?.join(" ");
  const errorEntries = Object.entries(errors).filter(([, messages]) => messages.length > 0);
  const showAdvancedPanel =
    advancedOpen || OPTIONAL_FIELD_LABELS.some(({ field }) => fieldVisible(field));

  return (
    <div className="grid gap-5">
      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          void submit(event);
        }}
        className="command-composer"
        data-testid="mission-form"
      >
        <div className="relative p-5 sm:p-6">
          {!runnerAvailable && (
            <div
              className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
              role="status"
            >
              <strong>The local runner is offline.</strong> Start it with <code>pnpm dev</code>.
              Your request can still be saved and will begin when the runner returns.
            </div>
          )}

          {requestError && (
            <div
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {requestError}
            </div>
          )}

          {errorEntries.length > 0 && (
            <div
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
              role="alert"
              data-testid="validation-summary"
            >
              <strong>Check the highlighted information:</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errorEntries.map(([key, messages]) => (
                  <li key={key}>
                    <a className="underline underline-offset-2" href={`#${errorTarget(key)}`}>
                      {messages.join(" ")}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="sr-only" htmlFor="description-field">
            Describe what you sell or paste your website
          </label>
          <textarea
            id="description-field"
            className="command-textarea"
            name="descriptionPrompt"
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              if (errors["description"] !== undefined) setErrors({});
            }}
            onBlur={applyDetectedWebsite}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            placeholder="Describe what you sell or paste your website"
            aria-invalid={errorFor("description") !== undefined}
            aria-describedby={errorFor("description") ? "description-error" : "composer-help"}
            autoFocus
          />
          <span id="composer-help" className="sr-only">
            Press Control Enter or Command Enter to start finding customers. Normal Enter creates a
            new line.
          </span>

          {promptAnalysis.kind === "url_only" && (
            <label
              className="mt-4 block text-sm font-medium text-neutral-800"
              htmlFor="description-follow-up-field"
            >
              Briefly describe what this product sells
              <textarea
                id="description-follow-up-field"
                className="text-area min-h-24"
                value={urlOnlyDescription}
                onChange={(event) => setUrlOnlyDescription(event.target.value)}
                placeholder="What does this product help customers do?"
                aria-invalid={errorFor("description") !== undefined}
              />
            </label>
          )}
          {errorFor("description") && (
            <span id="description-error" className="field-error">
              {errorFor("description")}
            </span>
          )}

          {(fieldVisible("website") ||
            website.length > 0 ||
            promptAnalysis.kind === "url_only") && (
            <div className="mt-4" id="website-field">
              <OptionalFieldHeader
                label="Product website"
                htmlFor="website-input"
                onRemove={() => removeField("website", ["website"])}
              />
              <input
                id="website-input"
                ref={(element) => {
                  fieldRefs.current.website = element;
                }}
                className="text-field"
                name="website"
                type="url"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://yourproduct.com"
                aria-invalid={errorFor("website") !== undefined}
              />
              {errorFor("website") && <span className="field-error">{errorFor("website")}</span>}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
            <div className="relative">
              <button
                ref={plusButtonRef}
                type="button"
                className="composer-control size-11 rounded-full px-0 text-xl"
                aria-label="Add mission context"
                aria-expanded={plusOpen}
                aria-controls="mission-context-menu"
                onClick={() => setPlusOpen((open) => !open)}
              >
                +
              </button>
              {plusOpen && (
                <div id="mission-context-menu" role="menu" className="composer-menu">
                  {OPTIONAL_FIELD_LABELS.map(({ field, label }) => (
                    <button
                      key={field}
                      type="button"
                      role="menuitem"
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none"
                      onClick={() => showField(field)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="composer-control"
              onClick={() => showField("website")}
              aria-pressed={fieldVisible("website") || website.length > 0}
            >
              ↗ <span>Website</span>
            </button>

            <label className="composer-select-label">
              <span className="sr-only">Customer geography</span>
              <select
                className="composer-select"
                value={geography}
                onChange={(event) =>
                  setGeography(event.target.value as (typeof GEOGRAPHY_OPTIONS)[number])
                }
                aria-label="Customer geography"
              >
                {GEOGRAPHY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="composer-select-label">
              <span className="sr-only">Number of opportunities</span>
              <select
                className="composer-select"
                value={opportunityCount}
                onChange={(event) =>
                  setOpportunityCount(event.target.value as (typeof OPPORTUNITY_OPTIONS)[number])
                }
                aria-label="Number of opportunities"
              >
                {OPPORTUNITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "Custom" ? option : `${option} customers`}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="composer-control"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              Advanced
            </button>

            <button
              className="composer-submit"
              type="submit"
              aria-busy={submitting}
              disabled={submitting}
              data-testid="composer-submit"
            >
              {submitting && <span className="loading-dot" aria-hidden="true" />}
              <span aria-live="polite">{submitLabel(submitStep)}</span>
            </button>
          </div>

          {geography === "Custom" && (
            <label
              className="mt-4 block text-sm font-medium text-neutral-800"
              htmlFor="custom-geographies-field"
            >
              Custom geographies
              <input
                id="custom-geographies-field"
                className="text-field"
                name="customGeographies"
                placeholder="United States, United Arab Emirates"
              />
              <span className="field-help">Separate locations with commas.</span>
            </label>
          )}

          {opportunityCount === "Custom" && (
            <label
              className="mt-4 block text-sm font-medium text-neutral-800"
              htmlFor="custom-opportunities-field"
            >
              Custom opportunity count
              <input
                id="custom-opportunities-field"
                className="text-field"
                name="customOpportunityCount"
                type="number"
                min="1"
                max="100"
                defaultValue="20"
              />
            </label>
          )}
        </div>

        <div
          className={
            showAdvancedPanel ? "border-t border-neutral-200 bg-neutral-50/60 p-5 sm:p-6" : "hidden"
          }
          data-testid="advanced-fields"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Optional context</p>
              <h2 className="mt-1 text-base font-semibold text-neutral-950">
                Help Cluvvi narrow the search
              </h2>
            </div>
            <button
              type="button"
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              onClick={() => setAdvancedOpen(false)}
            >
              Collapse
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label
              className={advancedOpen ? "field-label md:col-span-2" : "hidden"}
              id="customerOutcome-field"
            >
              Customer outcome
              <input
                className="text-field"
                name="customerOutcome"
                placeholder="Helps content teams publish faster with less manual editing."
              />
            </label>

            <div className={fieldVisible("price") ? "contents" : "hidden"} id="price-section">
              <div className="md:col-span-2">
                <OptionalFieldHeader
                  label="Price range"
                  htmlFor="price-minimum-field"
                  onRemove={() => removeField("price", ["priceMinimum", "priceMaximum"])}
                />
              </div>
              <label className="field-label" htmlFor="price-minimum-field">
                Minimum price
                <input
                  id="price-minimum-field"
                  ref={(element) => {
                    fieldRefs.current.price = element;
                  }}
                  className="text-field"
                  name="priceMinimum"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="100"
                />
              </label>
              <label className="field-label" htmlFor="price-maximum-field">
                Maximum price
                <input
                  id="price-maximum-field"
                  className="text-field"
                  name="priceMaximum"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="500"
                />
              </label>
              <label className="field-label" htmlFor="price-currency-field">
                Currency
                <input
                  id="price-currency-field"
                  className="text-field uppercase"
                  name="currency"
                  defaultValue="USD"
                  maxLength={3}
                />
              </label>
              <label className="field-label" htmlFor="billing-period-field">
                Billing period
                <select
                  id="billing-period-field"
                  className="text-field"
                  name="billingPeriod"
                  defaultValue="monthly"
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                  <option value="one_time">One time</option>
                  <option value="usage">Usage based</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
            </div>

            <div
              className={fieldVisible("exclusions") ? "md:col-span-2" : "hidden"}
              id="exclusions-field"
            >
              <OptionalFieldHeader
                label="Exclusions"
                htmlFor="exclusions-input"
                onRemove={() => removeField("exclusions", ["exclusions"])}
              />
              <textarea
                id="exclusions-input"
                ref={(element) => {
                  fieldRefs.current.exclusions = element;
                }}
                className="text-area min-h-24"
                name="exclusions"
                placeholder={"Hobby creators\nInactive channels\nShort-form-only creators"}
              />
              <span className="field-help">One exclusion per line.</span>
            </div>

            <div
              className={fieldVisible("goodCustomerExamples") ? "" : "hidden"}
              id="goodCustomerExamples-field"
            >
              <OptionalFieldHeader
                label="Good-customer examples"
                htmlFor="good-customer-examples-input"
                onRemove={() => removeField("goodCustomerExamples", ["goodCustomerExamples"])}
              />
              <textarea
                id="good-customer-examples-input"
                ref={(element) => {
                  fieldRefs.current.goodCustomerExamples = element;
                }}
                className="text-area min-h-24"
                name="goodCustomerExamples"
                placeholder="One example per line"
              />
            </div>

            <div
              className={fieldVisible("badCustomerExamples") ? "" : "hidden"}
              id="badCustomerExamples-field"
            >
              <OptionalFieldHeader
                label="Bad-customer examples"
                htmlFor="bad-customer-examples-input"
                onRemove={() => removeField("badCustomerExamples", ["badCustomerExamples"])}
              />
              <textarea
                id="bad-customer-examples-input"
                ref={(element) => {
                  fieldRefs.current.badCustomerExamples = element;
                }}
                className="text-area min-h-24"
                name="badCustomerExamples"
                placeholder="One example per line"
              />
            </div>

            <label className={advancedOpen ? "field-label" : "hidden"} id="capacityNotes-field">
              Capacity notes
              <textarea className="text-area min-h-24" name="capacityNotes" />
            </label>

            <div
              className={fieldVisible("additionalContext") ? "" : "hidden"}
              id="additionalContext-field"
            >
              <OptionalFieldHeader
                label="Additional context"
                htmlFor="additional-context-input"
                onRemove={() => removeField("additionalContext", ["additionalContext"])}
              />
              <textarea
                id="additional-context-input"
                ref={(element) => {
                  fieldRefs.current.additionalContext = element;
                }}
                className="text-area min-h-24"
                name="additionalContext"
              />
            </div>

            <label
              className={advancedOpen ? "field-label md:col-span-2" : "hidden"}
              id="name-field"
            >
              Run name <span className="font-normal text-neutral-400">Optional</span>
              <input
                className="text-field"
                name="name"
                placeholder="Video editing SaaS customer discovery"
              />
            </label>
          </div>
        </div>
      </form>

      <div className="flex flex-wrap justify-center gap-2" aria-label="Example customer searches">
        {EXAMPLE_PROMPTS.map((example) => (
          <button
            key={example}
            type="button"
            className="example-chip"
            onClick={() => {
              setPrompt(example);
              requestAnimationFrame(() => document.getElementById("description-field")?.focus());
            }}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
