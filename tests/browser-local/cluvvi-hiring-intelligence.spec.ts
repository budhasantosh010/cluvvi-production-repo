import { expect, test, type Locator, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { delimiter, dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const output = resolve(process.cwd(), "visual_qa");
const fixtureProject =
  process.env["CLUVVI_DISCOVERY_FIXTURE_PATH"]?.trim() ||
  resolve(process.cwd(), "tests/fixtures/local-discovery-engine");
const behaviorPath = resolve(fixtureProject, "behavior.json");
const browserHome =
  process.env["CLUVVI_HOME"]?.trim() || resolve(process.cwd(), ".cluvvi-test/browser-c1-j1");

async function setBehavior(mode: string): Promise<void> {
  await writeFile(behaviorPath, `${JSON.stringify({ mode }, null, 2)}\n`, "utf8");
}

async function hideDevelopmentUi(page: Page): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function submitMission(page: Page, label: string): Promise<string> {
  await page.goto("/", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await page
    .getByLabel("Describe what you sell or paste your website")
    .fill(
      `We sell data workflow software to businesses with ${label}. Use current public hiring evidence cautiously and never infer budget or purchase intent from jobs alone.`,
    );
  await page.getByTestId("composer-submit").click();
  await expect(page).toHaveURL(/\/runs\/run_[a-f0-9]{32}$/u);
  return page.url().split("/").at(-1) ?? "";
}

async function waitForStatus(page: Page, status: "completed" | "failed"): Promise<void> {
  await expect(page.getByTestId("run-view")).toHaveAttribute("data-run-status", status, {
    timeout: 90_000,
  });
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
}

async function assertSafeHiringCopy(scope: Locator): Promise<void> {
  await expect(scope).toContainText(/does not prove budget|not proof of budget/iu);
  await expect(scope).toContainText(/purchase intent/iu);
  await expect(scope).not.toContainText(
    /candidateEmail|resumeText|coverLetter|private ATS token/iu,
  );
}

function resolvePnpmInvocation(arguments_: string[]): { command: string; arguments: string[] } {
  if (process.platform !== "win32") return { command: "pnpm", arguments: arguments_ };
  const pathValue = process.env["Path"] ?? process.env["PATH"] ?? "";
  for (const directory of pathValue.split(delimiter)) {
    if (directory.trim().length === 0) continue;
    const shimPath = resolve(directory, "pnpm.cmd");
    if (!existsSync(shimPath)) continue;
    const pnpmCli = resolve(dirname(shimPath), "node_modules", "pnpm", "bin", "pnpm.cjs");
    if (existsSync(pnpmCli))
      return { command: process.execPath, arguments: [pnpmCli, ...arguments_] };
  }
  throw new Error("The PNPM CLI could not be resolved for the C1-J hiring resume proof.");
}

async function repairHiringSidecars(runId: string): Promise<void> {
  const exchange = resolve(browserHome, "runs", runId, "discovery-exchange");
  const requestPath = resolve(exchange, "discovery-request.v1.json");
  const outputPath = resolve(exchange, "search-results.v2.json");
  const invocation = resolvePnpmInvocation([
    "discover",
    requestPath,
    "--provider-mode",
    "fixture_only",
    "--extraction-mode",
    "selected_public_pages",
    "--max-extractions",
    "2",
    "--structured-content-mode",
    "selected_resources",
    "--max-structured-resources",
    "2",
    "--max-document-resources",
    "1",
    "--source-adapter-mode",
    "selected_sources",
    "--source-families",
    "hiring",
    "--max-hiring-targets",
    "2",
    "--max-hiring-boards-per-target",
    "3",
    "--max-hiring-jobs-per-board",
    "50",
    "--output",
    outputPath,
  ]);
  await execFileAsync(invocation.command, invocation.arguments, {
    cwd: fixtureProject,
    env: { ...process.env, CLUVVI_TEST_BEHAVIOR: JSON.stringify({ mode: "hiring-greenhouse" }) },
    windowsHide: true,
    timeout: 45_000,
  });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await setBehavior("hiring-greenhouse");
});

test.beforeEach(async () => {
  await setBehavior("hiring-greenhouse");
});

test.afterAll(async () => {
  await setBehavior("hiring-greenhouse");
});

test("operations desktop exposes opt-in hiring mode, families, budgets, and hard boundary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/operations/discovery", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await expect(page.getByLabel("Public source adapters")).toHaveValue("selected_sources");
  await expect(page.getByTestId("hiring-mode-card")).toContainText("Public ATS intelligence");
  const summary = page.getByTestId("discovery-runtime-summary");
  await expect(summary).toContainText("selected sources");
  await expect(summary).toContainText("hiring");
  await expect(summary).toContainText("100");
  await page.getByLabel("Public source adapters").selectOption("none");
  await expect(page.getByText("Preview only", { exact: true })).toBeVisible();
  await page.screenshot({
    path: resolve(output, "c1-j1-hiring-operations-desktop.png"),
    fullPage: true,
  });
});

test("operations mobile has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations/discovery", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await expect(page.getByTestId("hiring-mode-card")).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(output, "c1-j1-hiring-operations-mobile.png"),
    fullPage: true,
  });
});

test("target plan is visible with conservative company confidence", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await submitMission(page, "an official company careers page");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("hiring-intelligence-view");
  await expect(view.getByTestId("hiring-target-card")).toHaveCount(1);
  await expect(view).toContainText("confidence 0.92");
  await assertSafeHiringCopy(view);
  await view.screenshot({ path: resolve(output, "c1-j1-target-plan.png") });
});

test("provider ladder exposes partial and failed attempts without hiding them", async ({
  page,
}) => {
  await setBehavior("hiring-partial");
  await page.setViewportSize({ width: 1280, height: 900 });
  await submitMission(page, "multiple public ATS sources with one provider failure");
  await waitForStatus(page, "completed");
  const ladder = page.getByTestId("hiring-provider-ladder");
  await expect(ladder.locator('[data-provider="greenhouse_public_jobs"]')).toBeVisible();
  await expect(ladder.locator('[data-provider="ashby_public_jobs"]')).toHaveAttribute(
    "data-outcome",
    "failed",
  );
  await ladder.screenshot({ path: resolve(output, "c1-j1-provider-ladder.png") });
});

for (const scenario of [
  ["hiring-greenhouse", "greenhouse_public_jobs", "c1-j1-greenhouse.png"],
  ["hiring-ashby", "ashby_public_jobs", "c1-j1-ashby.png"],
  ["hiring-lever", "lever_public_jobs", "c1-j1-lever.png"],
  ["hiring-workable", "workable_public_jobs", "c1-j1-workable.png"],
] as const) {
  test(`${scenario[1]} success remains bounded and provenance-visible`, async ({ page }) => {
    await setBehavior(scenario[0]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await submitMission(page, `${scenario[1]} public hiring evidence`);
    await waitForStatus(page, "completed");
    const view = page.getByTestId("hiring-intelligence-view");
    await expect(view).toContainText(scenario[1].replaceAll("_", " "));
    await expect(view.getByTestId("public-job-list")).toContainText("Senior Data Engineer");
    await assertSafeHiringCopy(view);
    await view.screenshot({ path: resolve(output, scenario[2]) });
  });
}

test("JobPosting JSON-LD fallback remains explicit", async ({ page }) => {
  await setBehavior("hiring-jsonld-fallback");
  await page.setViewportSize({ width: 1280, height: 900 });
  await submitMission(page, "existing public JobPosting JSON-LD fallback evidence");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("hiring-intelligence-view");
  await expect(view).toContainText("jobposting jsonld");
  await assertSafeHiringCopy(view);
  await view.screenshot({ path: resolve(output, "c1-j1-jsonld-fallback.png") });
});

test("generic careers fallback remains explicit and conservative", async ({ page }) => {
  await setBehavior("hiring-generic-fallback");
  await page.setViewportSize({ width: 1280, height: 900 });
  await submitMission(page, "a generic official careers page fallback");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("hiring-intelligence-view");
  await expect(view).toContainText("generic careers page");
  await assertSafeHiringCopy(view);
  await view.screenshot({ path: resolve(output, "c1-j1-generic-fallback.png") });
});

test("multi-provider duplicate accounting stays visible and accepted jobs are not duplicated", async ({
  page,
}) => {
  await setBehavior("hiring-dedup");
  await submitMission(page, "duplicate public job representations across sources");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("hiring-intelligence-view");
  await expect(view.getByTestId("public-job-list").locator("details")).toHaveCount(1);
  await expect(view.getByTestId("hiring-telemetry")).toContainText("Duplicates removed: 1");
});

test("SmartRecruiters auth missing is an honest optional fallback, not a fabricated failure", async ({
  page,
}) => {
  await setBehavior("hiring-auth-missing");
  await submitMission(page, "optional authenticated-free SmartRecruiters access");
  await waitForStatus(page, "completed");
  const ladder = page.getByTestId("hiring-provider-ladder");
  await expect(ladder.locator('[data-provider="smartrecruiters_posting_api"]')).toHaveAttribute(
    "data-outcome",
    "auth_missing",
  );
  await expect(page.getByTestId("hiring-intelligence-view")).toContainText(
    /auth is missing|authentication was not configured/iu,
  );
});

test("partial provider failure remains honest", async ({ page }) => {
  await setBehavior("hiring-partial");
  await page.setViewportSize({ width: 1280, height: 900 });
  await submitMission(page, "one public ATS provider failing while another yields current jobs");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("hiring-intelligence-view");
  await expect(view).toContainText("One controlled provider failed safely");
  await expect(view.getByTestId("public-job-list")).toBeVisible();
  await page.screenshot({ path: resolve(output, "c1-j1-partial-failure.png"), fullPage: true });
});

test("all hiring sources unavailable fabricates no jobs or hiring signals", async ({ page }) => {
  await setBehavior("hiring-all-unavailable");
  await page.setViewportSize({ width: 1280, height: 900 });
  await submitMission(page, "all public hiring sources unavailable");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("hiring-intelligence-view");
  await expect(view.getByTestId("public-job-list")).toHaveCount(0);
  await expect(view.getByTestId("hiring-signal-list")).toHaveCount(0);
  await expect(view).toContainText("All controlled public hiring sources were unavailable");
  await page.screenshot({ path: resolve(output, "c1-j1-all-unavailable.png"), fullPage: true });
});

test("forbidden candidate data is rejected as an invalid hiring artifact", async ({ page }) => {
  await setBehavior("hiring-forbidden-field");
  await page.setViewportSize({ width: 1280, height: 900 });
  await submitMission(page, "an invalid sidecar containing a forbidden private candidate field");
  await waitForStatus(page, "failed");
  await expect(page.getByTestId("run-failure")).toContainText("HIRING_PRIVATE_DATA_REJECTED");
  await expect(page.getByTestId("hiring-intelligence-failure")).toContainText(
    "Repair the four hiring sidecars",
  );
  await expect(page.locator("body")).not.toContainText("private@example.com");
  await page.screenshot({ path: resolve(output, "c1-j1-invalid-artifact.png"), fullPage: true });
});

test("same-run repair resumes hiring independently and reuses search, extraction, and structured parsing", async ({
  page,
}) => {
  await setBehavior("hiring-forbidden-field");
  await page.setViewportSize({ width: 1280, height: 900 });
  const runId = await submitMission(page, "same-run hiring repair after a rejected sidecar");
  await waitForStatus(page, "failed");
  await setBehavior("hiring-greenhouse");
  await repairHiringSidecars(runId);
  await page.getByRole("button", { name: "Resume run" }).click();
  await waitForStatus(page, "completed");
  for (const stage of [
    "discovery",
    "frontier",
    "extraction",
    "extraction_telemetry",
    "structured_parsing",
    "content_parse_telemetry",
  ] as const) {
    await expect(page.locator(`[data-stage="${stage}"]`)).toHaveAttribute(
      "data-stage-status",
      "reused",
    );
  }
  await expect(page.getByTestId("hiring-intelligence-view")).toBeVisible();
  await page.screenshot({ path: resolve(output, "c1-j1-resumed.png"), fullPage: true });
});

test("Buyer Map exposes public-job and hiring-signal provenance without overclaiming", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await submitMission(page, "mission-relevant public data hiring");
  await waitForStatus(page, "completed");
  const buyerMap = page.getByTestId("project-b-fixture-pipeline");
  await expect(page.getByTestId("buyer-map-public-job-count")).toContainText(/[1-9]/u);
  await expect(page.getByTestId("buyer-map-hiring-signal-count")).toContainText(/[1-9]/u);
  await expect(page.getByTestId("buyer-map-hiring-provenance").first()).toContainText(
    /greenhouse|derived signal/iu,
  );
  await expect(buyerMap).toContainText(/does not prove budget|not proof of budget/iu);
  await expect(buyerMap).toContainText(/purchase intent/iu);
  await expect(buyerMap).toContainText(/confidence/iu);
  await buyerMap.screenshot({ path: resolve(output, "c1-j1-buyer-map-hiring.png") });
});

test("mobile hiring cards wrap titles and URLs without page-level overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await submitMission(page, "mobile public hiring evidence review");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("hiring-intelligence-view");
  await expect(view.getByTestId("public-job-list")).toContainText("Senior Data Engineer");
  await assertNoHorizontalOverflow(page);
  await view.screenshot({ path: resolve(output, "c1-j1-hiring-mobile-cards.png") });
});
