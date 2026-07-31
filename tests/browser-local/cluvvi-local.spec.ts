import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "visual_qa");

async function waitForCompletedFixtureRun(page: Page) {
  await expect(page).toHaveURL(/\/runs\/run_[a-f0-9]{32}$/);
  const runView = page.locator('[data-testid="run-view"]');
  await expect(runView).toHaveAttribute("data-run-status", "completed", { timeout: 30_000 });
  await expect(page.locator('[data-stage-status="completed"]')).toHaveCount(11);
  await expect(page.getByText("Fixture output — not real market data.")).toBeVisible();
  await expect(page.locator('[data-testid="artifact-json"]')).toContainText('"fixture": true');
  return page.url();
}

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

test("command-first home submits a text-only mission and preserves it in recent history", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Let's find your customers." })).toBeVisible();
  await expect(
    page.getByText("Tell Cluvvi what you sell. It finds companies showing evidence they need it."),
  ).toBeVisible();
  await expect(page.getByText("Local fixture mode")).toBeVisible();
  await page.getByText("Local fixture mode").hover();
  const fixtureExplanation = page.getByText(
    "This version demonstrates the complete workflow with deterministic test data. Real product understanding and market discovery are being connected next.",
  );
  await expect(fixtureExplanation).toBeVisible();
  await page.mouse.move(24, 90);
  await expect(fixtureExplanation).toBeHidden();

  const composer = page.locator('[data-testid="mission-form"]');
  const geometry = await composer.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, left: rect.left, right: rect.right };
  });
  expect(geometry.width).toBeLessThanOrEqual(842);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(1440);
  await page.screenshot({ path: resolve(output, "c06-home-desktop.png"), fullPage: true });

  const prompt = page.getByLabel("Describe what you sell or paste your website");
  await prompt.focus();
  await page.screenshot({
    path: resolve(output, "c06-composer-focused-desktop.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Find companies currently hiring video editors" }).click();
  await expect(prompt).toHaveValue("Find companies currently hiring video editors");
  await prompt.fill(
    "We sell AI-assisted software that creates rough cuts for long-form video production teams.",
  );

  await page.getByRole("button", { name: "Start finding customers" }).click();
  const runUrl = await waitForCompletedFixtureRun(page);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator('[data-testid="run-view"]')).toHaveAttribute(
    "data-run-status",
    "completed",
  );

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(
    page.getByText(/We sell AI-assisted software that creates rough cuts/).first(),
  ).toBeVisible();
  expect(runUrl).toContain("/runs/run_");
  expect(pageErrors).toEqual([]);
});

test("URL-aware composer reveals advanced context and sends only one logical submission", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });
  const prompt = page.getByLabel("Describe what you sell or paste your website");

  await prompt.fill("example.com");
  await prompt.blur();
  await expect(page.getByLabel("Briefly describe what this product sells")).toBeVisible();
  await expect(page.getByLabel("Product website")).toHaveValue("https://example.com/");

  await prompt.fill(
    "We sell video-editing software for podcast agencies: https://example.com/pricing",
  );
  await prompt.blur();
  await expect(page.getByLabel("Briefly describe what this product sells")).toBeHidden();
  await expect(page.getByLabel("Product website")).toHaveValue("https://example.com/");
  await page.getByLabel("Product website").fill("https://example.com/pricing");

  await page.getByRole("button", { name: "Advanced" }).click();
  await expect(page.getByTestId("advanced-fields")).toBeVisible();
  await page.getByLabel("Customer geography").selectOption("United Arab Emirates");
  await page.getByLabel("Number of opportunities").selectOption("30");
  await page
    .getByLabel("Customer outcome")
    .fill("Publish more long-form episodes with less manual editing.");
  await page.getByLabel("Exclusions").fill("Hobby creators\nShort-form-only teams");
  await page.screenshot({ path: resolve(output, "c06-advanced-desktop.png"), fullPage: true });

  let createRequestCount = 0;
  page.on("request", (browserRequest) => {
    if (browserRequest.method() === "POST" && browserRequest.url().endsWith("/api/runs")) {
      createRequestCount += 1;
    }
  });
  await page.getByRole("button", { name: "Start finding customers" }).dblclick();
  const runUrl = await waitForCompletedFixtureRun(page);
  expect(createRequestCount).toBe(1);

  const runId = runUrl.split("/").at(-1)!;
  const mission = {
    schemaVersion: "1.0",
    name: "C0.6 idempotency API proof",
    description:
      "A command-first browser API mission proving duplicate requests return one logical durable run.",
    geographies: ["Global"],
    desiredOpportunities: 20,
    exclusions: [],
    goodCustomerExamples: [],
    badCustomerExamples: [],
  };
  const idempotencyKey = `playwright_${crypto.randomUUID()}`;
  const first = await request.post("/api/runs", {
    headers: { "Idempotency-Key": idempotencyKey },
    data: mission,
  });
  const duplicate = await request.post("/api/runs", {
    headers: { "Idempotency-Key": idempotencyKey },
    data: mission,
  });
  expect(first.status()).toBe(201);
  expect(duplicate.status()).toBe(200);
  const firstBody = (await first.json()) as { run: { id: string }; created: boolean };
  const duplicateBody = (await duplicate.json()) as { run: { id: string }; created: boolean };
  expect(firstBody.created).toBe(true);
  expect(duplicateBody.created).toBe(false);
  expect(duplicateBody.run.id).toBe(firstBody.run.id);

  const traversal = await request.get(
    `/api/runs/${runId}/artifacts/${encodeURIComponent("../../secret")}`,
  );
  expect(traversal.status()).toBeGreaterThanOrEqual(400);
});

test("composer exposes validation, loading, duplicate prevention, and API errors", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });
  const prompt = page.getByLabel("Describe what you sell or paste your website");
  await prompt.fill("Too short");
  await page.getByRole("button", { name: "Start finding customers" }).click();
  await expect(page.getByTestId("validation-summary")).toBeVisible();
  await expect(
    page.getByText("Describe what you sell using at least 20 characters.").first(),
  ).toBeVisible();
  await page.screenshot({ path: resolve(output, "c06-validation-desktop.png"), fullPage: true });

  let interceptedRequests = 0;
  await page.route("**/api/runs", async (route) => {
    interceptedRequests += 1;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "Deliberate C0.6 browser API failure.", retryable: true },
      }),
    });
  });
  await prompt.fill(
    "We sell workflow software for teams that need a clear API error and loading-state test.",
  );
  const submit = page.getByRole("button", { name: "Start finding customers" });
  await submit.dblclick();
  await expect(submit).toBeDisabled();
  await expect(page.getByText("Deliberate C0.6 browser API failure.")).toBeVisible();
  expect(interceptedRequests).toBe(1);
});

test("mobile command interface has no overflow and keeps popovers and controls reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Let's find your customers." })).toBeVisible();
  await page.screenshot({ path: resolve(output, "c06-home-mobile.png"), fullPage: false });

  const prompt = page.getByLabel("Describe what you sell or paste your website");
  await prompt.focus();
  await page.screenshot({
    path: resolve(output, "c06-composer-focused-mobile.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Advanced" }).click();
  await expect(page.getByTestId("advanced-fields")).toBeVisible();
  await page.screenshot({ path: resolve(output, "c06-advanced-mobile.png"), fullPage: false });

  await page.getByRole("button", { name: "Add mission context" }).click();
  const menuGeometry = await page.locator('[role="menu"]').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width };
  });
  expect(menuGeometry.left).toBeGreaterThanOrEqual(0);
  expect(menuGeometry.right).toBeLessThanOrEqual(390);

  const mobileGeometry = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    controls: [...document.querySelectorAll("input, textarea, select, button, summary")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, height: rect.height };
      }),
  }));
  expect(mobileGeometry.bodyScrollWidth).toBeLessThanOrEqual(mobileGeometry.innerWidth);
  for (const control of mobileGeometry.controls) {
    expect(control.right).toBeLessThanOrEqual(mobileGeometry.innerWidth + 0.5);
    expect(control.left).toBeGreaterThanOrEqual(-0.5);
    expect(control.height).toBeGreaterThanOrEqual(40);
  }

  await page.keyboard.press("Escape");
  await expect(page.locator('[role="menu"]')).toBeHidden();
  await page.getByRole("button", { name: "Collapse" }).click();
  await expect(page.getByTestId("advanced-fields")).toBeHidden();
  await page.screenshot({ path: resolve(output, "c06-home-mobile-full.png"), fullPage: true });
});
