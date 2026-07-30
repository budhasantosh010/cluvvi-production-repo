"use client";

import { useActionState } from "react";
import { createMissionAction } from "@/app/actions";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

export function MissionForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState(createMissionAction, INITIAL_ACTION_STATE);

  return (
    <form action={action} className="space-y-8">
      <input name="workspaceId" type="hidden" value={workspaceId} />

      <section className="form-section">
        <div>
          <p className="step-number">1</p>
          <h2 className="section-title">What are you selling?</h2>
          <p className="section-copy">Give Cluvvi enough context to recognize a real fit later.</p>
        </div>
        <div className="space-y-4">
          <label className="field-label">
            Mission name
            <input
              className="text-field"
              maxLength={120}
              name="name"
              placeholder="Find teams that need faster video editing"
              required
            />
          </label>
          <label className="field-label">
            Product website
            <input
              className="text-field"
              name="websiteUrl"
              placeholder="https://yourproduct.com"
              required
              type="url"
            />
          </label>
          <label className="field-label">
            What do you sell?
            <textarea
              className="text-area"
              maxLength={5000}
              name="rawDescription"
              placeholder="An AI rough-cut editor for long-form talking-head videos…"
              required
              rows={5}
            />
          </label>
          <label className="field-label">
            What result does the customer receive?
            <textarea
              className="text-area"
              maxLength={2000}
              name="customerOutcome"
              placeholder="They publish long-form videos faster with less manual editing labor."
              required
              rows={3}
            />
          </label>
        </div>
      </section>

      <section className="form-section">
        <div>
          <p className="step-number">2</p>
          <h2 className="section-title">Who can buy it?</h2>
          <p className="section-copy">Keep the search commercially realistic and bounded.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label sm:col-span-2">
            Customer locations
            <input
              className="text-field"
              name="geographies"
              placeholder="United States, United Kingdom, UAE"
              required
            />
            <span className="field-help">Separate locations with commas.</span>
          </label>
          <label className="field-label">
            Minimum price
            <input
              className="text-field"
              min="0"
              name="priceMin"
              placeholder="99"
              step="0.01"
              type="number"
            />
          </label>
          <label className="field-label">
            Maximum price
            <input
              className="text-field"
              min="0"
              name="priceMax"
              placeholder="499"
              step="0.01"
              type="number"
            />
          </label>
          <label className="field-label">
            Currency
            <input
              className="text-field"
              defaultValue="USD"
              maxLength={3}
              name="currency"
              required
            />
          </label>
          <label className="field-label">
            Customers needed
            <input
              className="text-field"
              defaultValue="20"
              max="100"
              min="1"
              name="desiredCount"
              required
              type="number"
            />
          </label>
        </div>
      </section>

      <section className="form-section">
        <div>
          <p className="step-number">3</p>
          <h2 className="section-title">What should Cluvvi avoid?</h2>
          <p className="section-copy">Clear exclusions protect quality before research begins.</p>
        </div>
        <div className="space-y-4">
          <label className="field-label">
            Never include
            <textarea
              className="text-area"
              name="exclusions"
              placeholder={"Short-form-only creators\nCompanies outside our supported countries"}
              rows={4}
            />
            <span className="field-help">Use one exclusion per line.</span>
          </label>
          <label className="field-label">
            Delivery capacity notes
            <textarea
              className="text-area"
              maxLength={2000}
              name="capacityNotes"
              placeholder="We can onboard five customers this month."
              rows={3}
            />
          </label>
        </div>
      </section>

      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton idleLabel="Save mission" pendingLabel="Saving mission…" />
      </div>
    </form>
  );
}
