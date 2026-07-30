"use client";

import { MissionInputSchemaV1 } from "@cluvvi/core/mission";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface LocalMissionFormProps {
  runnerAvailable: boolean;
}

type FieldErrors = Record<string, string[]>;

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

export function LocalMissionForm({ runnerAvailable }: LocalMissionFormProps) {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    const description = String(form.get("description") ?? "").trim();
    const minimum = optionalNumber(form.get("priceMinimum"));
    const maximum = optionalNumber(form.get("priceMaximum"));
    const website = String(form.get("website") ?? "").trim();
    const customerOutcome = String(form.get("customerOutcome") ?? "").trim();
    const capacityNotes = String(form.get("capacityNotes") ?? "").trim();
    const additionalContext = String(form.get("additionalContext") ?? "").trim();
    const nameInput = String(form.get("name") ?? "").trim();
    const mission = {
      schemaVersion: "1.0" as const,
      name: nameInput || `${description.slice(0, 72)} customer discovery`,
      ...(website.length === 0 ? {} : { website }),
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
      geographies: lines(form.get("geographies")),
      desiredOpportunities: Number(form.get("desiredOpportunities") ?? 20),
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
        nextErrors[key].push(issue.message);
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setRequestError(null);
    setSubmitting(true);
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
        return;
      }
      router.push(body.links.page);
    } catch {
      setRequestError("The local web server could not be reached. Your values are still here.");
    } finally {
      setSubmitting(false);
    }
  }

  const errorFor = (name: string) => errors[name]?.join(" ");

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      className="surface-card overflow-hidden"
      data-testid="mission-form"
    >
      <div className="border-b border-neutral-200 bg-neutral-50/80 px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">New discovery run</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Tell Cluvvi what you sell</h2>
          </div>
          <span className="fixture-badge">Fixture mode</span>
        </div>
      </div>

      <div className="grid gap-6 p-6 sm:p-8">
        {!runnerAvailable && (
          <div
            className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
            role="status"
          >
            <strong>The local runner is offline.</strong> Start the complete environment with{" "}
            <code>pnpm dev</code>. Your run can still be saved durably and will begin when the
            runner returns.
          </div>
        )}
        {requestError && (
          <div
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            {requestError}
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <label className="field-label md:col-span-2">
            What do you sell? <span className="text-red-600">*</span>
            <textarea
              className="text-area min-h-32"
              name="description"
              required
              minLength={20}
              placeholder="AI-assisted video-editing software that creates rough cuts for long-form talking-head videos."
              aria-describedby={errorFor("description") ? "description-error" : undefined}
            />
            {errorFor("description") && (
              <span id="description-error" className="field-error">
                {errorFor("description")}
              </span>
            )}
          </label>

          <label className="field-label">
            Product website <span className="font-normal text-neutral-400">Optional</span>
            <input
              className="text-field"
              name="website"
              type="url"
              placeholder="https://yourproduct.com"
            />
            {errorFor("website") && <span className="field-error">{errorFor("website")}</span>}
          </label>

          <label className="field-label">
            What result does it provide?
            <input
              className="text-field"
              name="customerOutcome"
              placeholder="Helps content teams publish faster with less manual editing."
            />
          </label>
        </div>

        <div className="grid gap-5 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="field-label">
            Minimum price
            <input
              className="text-field"
              name="priceMinimum"
              type="number"
              min="0"
              step="0.01"
              placeholder="100"
            />
          </label>
          <label className="field-label">
            Maximum price
            <input
              className="text-field"
              name="priceMaximum"
              type="number"
              min="0"
              step="0.01"
              placeholder="500"
            />
          </label>
          <label className="field-label">
            Currency
            <input
              className="text-field uppercase"
              name="currency"
              defaultValue="USD"
              maxLength={3}
            />
          </label>
          <label className="field-label">
            Billing period
            <select className="text-field" name="billingPeriod" defaultValue="monthly">
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
              <option value="one_time">One time</option>
              <option value="usage">Usage based</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="field-label">
            Customer location
            <input
              className="text-field"
              name="geographies"
              defaultValue="Global"
              placeholder="United States, UAE"
            />
            <span className="field-help">Separate locations with commas.</span>
          </label>
          <label className="field-label">
            Number of opportunities
            <input
              className="text-field"
              name="desiredOpportunities"
              type="number"
              min="1"
              max="100"
              defaultValue="20"
            />
          </label>
          <label className="field-label md:col-span-2">
            Exclusions
            <textarea
              className="text-area min-h-24"
              name="exclusions"
              placeholder={"Hobby creators\nInactive channels\nShort-form-only creators"}
            />
            <span className="field-help">One exclusion per line.</span>
          </label>
        </div>

        <details className="rounded-2xl border border-neutral-200 bg-white p-5">
          <summary className="cursor-pointer select-none font-semibold text-neutral-900">
            Advanced context
          </summary>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="field-label md:col-span-2">
              Run name
              <input
                className="text-field"
                name="name"
                placeholder="Video editing SaaS customer discovery"
              />
            </label>
            <label className="field-label">
              Good-customer examples
              <textarea
                className="text-area min-h-24"
                name="goodCustomerExamples"
                placeholder="One example per line"
              />
            </label>
            <label className="field-label">
              Bad-customer examples
              <textarea
                className="text-area min-h-24"
                name="badCustomerExamples"
                placeholder="One example per line"
              />
            </label>
            <label className="field-label">
              Capacity notes
              <textarea className="text-area min-h-24" name="capacityNotes" />
            </label>
            <label className="field-label">
              Additional context
              <textarea className="text-area min-h-24" name="additionalContext" />
            </label>
          </div>
        </details>
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-200 bg-neutral-50/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="max-w-xl text-xs leading-5 text-neutral-500">
          Current output is deterministic fixture data. No real companies or contacts are being
          discovered yet.
        </p>
        <button className="button-primary min-w-48" disabled={submitting} type="submit">
          {submitting ? "Creating your Cluvvi run…" : "Run fixture workflow"}
        </button>
      </div>
    </form>
  );
}
