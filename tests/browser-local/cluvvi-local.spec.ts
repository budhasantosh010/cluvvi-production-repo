import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "visual_qa");

async function hideDevelopmentUi(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function waitForCompletedFixtureRun(page: Page) {
  await expect(page).toHaveURL(/\/runs\/run_[a-f0-9]{32}$/);
  const runView = page.locator('[data-testid="run-view"]');
  await expect(runView).toHaveAttribute("data-run-status", "completed", { timeout: 30_000 });
  await expect(page.locator('[data-stage-status="completed"]')).toHaveCount(11);
  await expect(page.getByText("Fixture Buyer Map — no live market results.")).toBeVisible();
  await expect(page.getByTestId("mission-understanding")).toBeVisible();
  await expect(
    page
      .getByTestId("mission-understanding")
      .getByRole("heading", { name: "Mission understanding", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("These planned queries were not sent to external sources.", { exact: false }),
  ).toBeVisible();
  const projectB = page.getByTestId("project-b-fixture-pipeline");
  await expect(projectB).toBeVisible();
  await expect(projectB.getByRole("heading", { name: "Fixture Buyer Map" })).toBeVisible();
  await expect(projectB.getByTestId("buyer-map-opportunity")).toHaveCount(3);
  await expect(projectB.getByText("Fixture Frame Studio", { exact: true }).first()).toBeVisible();
  await expect(projectB.getByText("Negative", { exact: true }).first()).toBeVisible();
  await expect(projectB.getByTestId("buyer-map-coverage-gaps")).toContainText(
    "private manual sources",
  );
  await expect(
    page
      .getByTestId("mission-search-queries")
      .getByText("podcast agency struggling with editing turnaround"),
  ).toBeVisible();
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
  await hideDevelopmentUi(page);

  await expect(page.getByRole("heading", { name: "Let's find your customers." })).toBeVisible();
  await expect(
    page.getByText("Tell Cluvvi what you sell. It finds companies showing evidence they need it."),
  ).toBeVisible();
  await expect(page.getByText("Local fixture mode")).toBeVisible();
  await page.getByText("Local fixture mode").hover();
  const fixtureExplanation = page.getByText(
    "Mission understanding is real local logic. Evidence, identity, ranking, and Buyer Map use synthetic companies from a version-controlled search_results.v2 fixture. No live market source is queried.",
  );
  await expect(fixtureExplanation).toBeVisible();
  await page.mouse.move(24, 90);
  await expect(fixtureExplanation).toBeHidden();

  const composer = page.locator('[data-testid="mission-form"]');
  const geometry = await composer.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, left: rect.left, right: rect.right };
  });
  expect(geometry.width).toBeLessThanOrEqual(722);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(1440);
  const idleSubmit = page.getByTestId("composer-submit");
  const tactileStyles = await idleSubmit.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      minWidth: Number.parseFloat(style.minWidth),
      transitionProperty: style.transitionProperty,
    };
  });
  expect(tactileStyles.minWidth).toBeGreaterThanOrEqual(180);
  expect(tactileStyles.transitionProperty).toContain("transform");
  await page.screenshot({ path: resolve(output, "c0-9-home-desktop.png"), fullPage: true });

  const prompt = page.getByLabel("Describe what you sell or paste your website");
  const promptGeometry = await prompt.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { height: rect.height, resize: style.resize, maxHeight: style.maxHeight };
  });
  expect(promptGeometry.height).toBeGreaterThanOrEqual(96);
  expect(promptGeometry.height).toBeLessThanOrEqual(130);
  expect(promptGeometry.resize).toBe("vertical");
  expect(promptGeometry.maxHeight).toBe("256px");
  await prompt.focus();
  await page.screenshot({
    path: resolve(output, "c0-9-composer-focused-desktop.png"),
    fullPage: false,
  });
  const exampleChip = page.getByRole("button", {
    name: "Find companies currently hiring video editors",
  });
  await exampleChip.dispatchEvent("pointerdown", { pointerType: "mouse", button: 0, buttons: 1 });
  await expect(exampleChip).toHaveAttribute("data-pressed", "true");
  await exampleChip.dispatchEvent("pointerup", { pointerType: "mouse", button: 0, buttons: 0 });
  await expect(exampleChip).toHaveAttribute("data-pressed", "false");
  await exampleChip.click();
  await expect(prompt).toHaveValue("Find companies currently hiring video editors");
  await prompt.fill(
    "We sell AI-assisted software that creates rough cuts for long-form video production teams.",
  );

  await page.evaluate(() => {
    const form = document.querySelector<HTMLElement>('[data-testid="mission-form"]');
    if (form === null) throw new Error("Mission form was not found.");
    const record = () => {
      const states = JSON.parse(sessionStorage.getItem("c09-submit-states") ?? "[]") as Array<{
        state: string;
        status: string;
      }>;
      states.push({
        state: form.dataset.submitState ?? "missing",
        status:
          form
            .querySelector<HTMLElement>('[data-testid="composer-submit-status"]')
            ?.textContent.trim() ?? "",
      });
      sessionStorage.setItem("c09-submit-states", JSON.stringify(states));
    };
    sessionStorage.setItem("c09-submit-states", "[]");
    new MutationObserver(record).observe(form, {
      attributes: true,
      attributeFilter: ["data-submit-state"],
    });
  });

  const submit = page.getByTestId("composer-submit");
  await submit.dispatchEvent("pointerdown", { pointerType: "mouse", button: 0, buttons: 1 });
  await expect(submit).toHaveAttribute("data-pressed", "true");
  await submit.dispatchEvent("pointerup", { pointerType: "mouse", button: 0, buttons: 0 });
  await expect(submit).toHaveAttribute("data-pressed", "false");
  await submit.click();
  const runUrl = await waitForCompletedFixtureRun(page);
  const submitStates = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("c09-submit-states") ?? "[]") as Array<{
        state: string;
        status: string;
      }>,
  );
  expect(submitStates.some((entry) => entry.state === "creating")).toBe(true);
  expect(
    submitStates.some(
      (entry) => entry.state === "opening" && entry.status.includes("Run created. Opening details"),
    ),
  ).toBe(true);
  const firstStage = page.locator('[data-stage-status="completed"]').first();
  await firstStage.evaluate((element) => element.classList.add("stage-running"));
  const pulseAnimation = await firstStage
    .locator(".stage-icon")
    .evaluate((element) => getComputedStyle(element, "::after").animationName);
  expect(pulseAnimation).toBe("stage-pulse");
  const artifactTransition = await page
    .locator(".artifact-tab")
    .first()
    .evaluate((element) => getComputedStyle(element).transitionProperty);
  expect(artifactTransition).toContain("transform");
  await page.screenshot({
    path: resolve(output, "c0-9-run-detail-desktop.png"),
    fullPage: true,
  });
  await page.getByTestId("project-b-fixture-pipeline").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: resolve(output, "c1-f-buyer-map-desktop.png"),
    fullPage: false,
  });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator('[data-testid="run-view"]')).toHaveAttribute(
    "data-run-status",
    "completed",
  );
  await expect(page.getByTestId("mission-understanding")).toBeVisible();

  await page.goto("/", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await expect(
    page.getByText(/We sell AI-assisted software that creates rough cuts/).first(),
  ).toBeVisible();
  const recentRow = page.locator(".recent-run-row").first();
  const recentRadius = await recentRow.evaluate(
    (element) => getComputedStyle(element).borderRadius,
  );
  expect(Number.parseFloat(recentRadius)).toBeGreaterThan(0);
  await recentRow.hover();
  const recentShadow = await recentRow.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(recentShadow).not.toBe("none");
  expect(runUrl).toContain("/runs/run_");
  expect(pageErrors).toEqual([]);
});

test("URL-aware composer reveals advanced context and sends only one logical submission", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
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

  const plusButton = page.getByRole("button", { name: "Add mission context" });
  await plusButton.dispatchEvent("pointerdown", { pointerType: "touch", button: 0, buttons: 1 });
  await expect(plusButton).toHaveAttribute("data-pressed", "true");
  await plusButton.dispatchEvent("pointerup", { pointerType: "touch", button: 0, buttons: 0 });
  await expect(plusButton).toHaveAttribute("data-pressed", "false");
  await plusButton.click();
  const plusMenu = page.locator('[role="menu"]');
  await expect(plusMenu).toBeVisible();
  await plusMenu.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  await page.screenshot({ path: resolve(output, "c0-9-plus-menu.png"), fullPage: false });
  await page.keyboard.press("Escape");

  const websiteButton = page.getByRole("button", { name: "Website" });
  await websiteButton.dispatchEvent("pointerdown", {
    pointerType: "mouse",
    button: 0,
    buttons: 1,
  });
  await expect(websiteButton).toHaveAttribute("data-pressed", "true");
  await websiteButton.dispatchEvent("pointerup", { pointerType: "mouse", button: 0, buttons: 0 });
  await expect(websiteButton).toHaveAttribute("data-pressed", "false");

  const advancedButton = page.getByRole("button", { name: "Advanced" });
  await advancedButton.dispatchEvent("pointerdown", {
    pointerType: "mouse",
    button: 0,
    buttons: 1,
  });
  await expect(advancedButton).toHaveAttribute("data-pressed", "true");
  await advancedButton.dispatchEvent("pointerup", { pointerType: "mouse", button: 0, buttons: 0 });
  await expect(advancedButton).toHaveAttribute("data-pressed", "false");
  await advancedButton.click();
  await expect(page.getByTestId("advanced-fields")).toBeVisible();
  await page.getByLabel("Customer geography").selectOption("United Arab Emirates");
  await page.getByLabel("Number of opportunities").selectOption("30");
  await page
    .getByLabel("Customer outcome")
    .fill("Publish more long-form episodes with less manual editing.");
  await page.getByLabel("Exclusions").fill("Hobby creators\nShort-form-only teams");
  await page.screenshot({ path: resolve(output, "c0-9-advanced-context.png"), fullPage: true });

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
  const apiMission = {
    schemaVersion: "1.0",
    name: "C1-A idempotency API proof",
    description:
      "A command-first browser mission proving duplicate requests return one logical durable run while preserving mission understanding.",
    geographies: ["Global"],
    desiredOpportunities: 20,
    exclusions: [],
    goodCustomerExamples: [],
    badCustomerExamples: [],
  };
  const idempotencyKey = `playwright_${crypto.randomUUID()}`;
  const first = await request.post("/api/runs", {
    headers: { "Idempotency-Key": idempotencyKey },
    data: apiMission,
  });
  const duplicate = await request.post("/api/runs", {
    headers: { "Idempotency-Key": idempotencyKey },
    data: apiMission,
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
  await hideDevelopmentUi(page);
  const prompt = page.getByLabel("Describe what you sell or paste your website");
  await prompt.fill("Too short");
  await page.getByRole("button", { name: "Start finding customers" }).click();
  await expect(page.getByTestId("validation-summary")).toBeVisible();
  await expect(
    page.getByText("Describe what you sell using at least 20 characters.").first(),
  ).toBeVisible();
  await page.screenshot({ path: resolve(output, "c0-9-validation-desktop.png"), fullPage: true });

  let interceptedRequests = 0;
  let releaseRequest: (() => void) | undefined;
  const requestGate = new Promise<void>((resolveGate) => {
    releaseRequest = resolveGate;
  });
  await page.route("**/api/runs", async (route) => {
    interceptedRequests += 1;
    await requestGate;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "Deliberate C0.9 browser API failure.", retryable: true },
      }),
    });
  });
  await prompt.fill(
    "We sell workflow software for teams that need a clear API error and loading-state test.",
  );
  const form = page.getByTestId("mission-form");
  const submit = page.getByTestId("composer-submit");
  const status = page.getByTestId("composer-submit-status");
  const idleBox = await submit.boundingBox();
  expect(idleBox).not.toBeNull();
  await submit.dblclick();
  await expect(form).toHaveAttribute("data-submit-state", "creating");
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await expect(submit).toContainText("Starting run…");
  await expect(submit.locator(".loading-dot")).toBeVisible();
  await expect(status).toBeVisible();
  await expect(status).toContainText("Creating your run locally…");
  await expect(status.locator(".loading-dot")).toBeVisible();
  const busyBox = await submit.boundingBox();
  expect(busyBox).not.toBeNull();
  expect(busyBox?.width).toBeCloseTo(idleBox?.width ?? 0, 3);
  expect(busyBox?.height).toBeCloseTo(idleBox?.height ?? 0, 3);
  await page.screenshot({
    path: resolve(output, "c0-9-submit-loading-desktop.png"),
    fullPage: false,
  });
  releaseRequest?.();
  await expect(page.getByText("Deliberate C0.9 browser API failure.")).toBeVisible();
  await expect(form).toHaveAttribute("data-submit-state", "idle");
  await expect(status).toBeHidden();
  await expect(submit).toBeEnabled();
  await expect(submit).toHaveAttribute("aria-busy", "false");
  await expect(submit).toContainText("Start finding customers →");
  expect(interceptedRequests).toBe(1);
});

test("reduced motion removes tactile animation while preserving layout", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);

  const prompt = page.getByLabel("Describe what you sell or paste your website");
  await prompt.focus();
  const composerMotion = await page.locator('[data-testid="mission-form"]').evaluate((element) => {
    const style = getComputedStyle(element);
    return { transitionProperty: style.transitionProperty, transform: style.transform };
  });
  expect(composerMotion.transitionProperty).toBe("none");
  expect(composerMotion.transform).toBe("none");

  const reducedSubmit = page.getByTestId("composer-submit");
  await reducedSubmit.dispatchEvent("pointerdown", {
    pointerType: "mouse",
    button: 0,
    buttons: 1,
  });
  await expect(reducedSubmit).toHaveAttribute("data-pressed", "true");
  const submitMotion = await reducedSubmit.evaluate((element) => {
    const style = getComputedStyle(element);
    return { transitionProperty: style.transitionProperty, transform: style.transform };
  });
  expect(submitMotion.transitionProperty).toBe("none");
  expect(submitMotion.transform).toBe("none");
  await reducedSubmit.dispatchEvent("pointerup", {
    pointerType: "mouse",
    button: 0,
    buttons: 0,
  });

  await page.getByRole("button", { name: "Add mission context" }).click();
  const menuMotion = await page.locator('[role="menu"]').evaluate((element) => ({
    animationName: getComputedStyle(element).animationName,
    transform: getComputedStyle(element).transform,
  }));
  expect(menuMotion.animationName).toBe("none");
  expect(menuMotion.transform).toBe("none");
  await page.keyboard.press("Escape");
  await expect(page.locator('[role="menu"]')).toBeHidden();
  await page.screenshot({
    path: resolve(output, "c0-9-reduced-motion-if-possible.png"),
    fullPage: false,
  });
});

test("mobile command interface has no overflow and keeps mission understanding reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await expect(page.getByRole("heading", { name: "Let's find your customers." })).toBeVisible();
  await page.screenshot({ path: resolve(output, "c0-9-home-mobile.png"), fullPage: false });

  const prompt = page.getByLabel("Describe what you sell or paste your website");
  await prompt.focus();
  await page.screenshot({
    path: resolve(output, "c0-9-composer-focused-mobile.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Advanced" }).click();
  await expect(page.getByTestId("advanced-fields")).toBeVisible();
  await page.screenshot({ path: resolve(output, "c0-9-advanced-mobile.png"), fullPage: false });

  await page.getByRole("button", { name: "Add mission context" }).click();
  const menuGeometry = await page.locator('[role="menu"]').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      animationName: style.animationName,
    };
  });
  expect(menuGeometry.left).toBeGreaterThanOrEqual(0);
  expect(menuGeometry.right).toBeLessThanOrEqual(390);
  expect(menuGeometry.animationName).toBe("composer-menu-in");

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
  await page.screenshot({ path: resolve(output, "c0-9-home-mobile-full.png"), fullPage: true });

  await prompt.fill(
    "AI-assisted video-editing software that creates rough cuts for long-form YouTube videos and podcasts.",
  );

  let releaseMobileRequest: (() => void) | undefined;
  const mobileRequestGate = new Promise<void>((resolveGate) => {
    releaseMobileRequest = resolveGate;
  });
  await page.route("**/api/runs", async (route) => {
    await mobileRequestGate;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "Deliberate C0.9 mobile loading proof.", retryable: true },
      }),
    });
  });

  const mobileSubmit = page.getByTestId("composer-submit");
  const mobileStatus = page.getByTestId("composer-submit-status");
  await mobileSubmit.click();
  await expect(mobileSubmit).toHaveAttribute("aria-busy", "true");
  await expect(mobileStatus).toContainText("Creating your run locally…");
  const mobileSubmitBox = await mobileSubmit.boundingBox();
  expect(mobileSubmitBox).not.toBeNull();
  expect(mobileSubmitBox?.width).toBeGreaterThan(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(output, "c0-9-submit-loading-mobile.png"),
    fullPage: false,
  });
  releaseMobileRequest?.();
  await expect(page.getByText("Deliberate C0.9 mobile loading proof.")).toBeVisible();
  await page.unroute("**/api/runs");

  await mobileSubmit.click();
  await waitForCompletedFixtureRun(page);
  const runGeometry = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(runGeometry.bodyScrollWidth).toBeLessThanOrEqual(runGeometry.innerWidth);
  await page.getByTestId("project-b-fixture-pipeline").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: resolve(output, "c1-f-buyer-map-mobile.png"),
    fullPage: false,
  });
  await page.screenshot({
    path: resolve(output, "c0-9-run-detail-mobile.png"),
    fullPage: true,
  });
});
