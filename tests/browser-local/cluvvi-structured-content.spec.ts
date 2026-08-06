import { expect, test, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { delimiter, dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const output = resolve(process.cwd(), "visual_qa");
const fixtureProject =
  process.env["CLUVVI_DISCOVERY_FIXTURE_PATH"]?.trim() ||
  resolve(process.cwd(), "tests/fixtures/local-discovery-engine");
const behaviorPath = resolve(fixtureProject, "behavior.json");
const browserHome =
  process.env["CLUVVI_HOME"]?.trim() ||
  resolve(process.cwd(), ".cluvvi-test/browser-structured-c1i5");

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
      `We sell AI-assisted video editing and approval software for creator businesses with ${label}, structured public documents, manual production work, and long turnaround times.`,
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
  throw new Error("The PNPM CLI could not be resolved for the structured resume proof.");
}

async function repairStructuredSidecars(runId: string): Promise<void> {
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
    "--output",
    outputPath,
  ]);
  await execFileAsync(invocation.command, invocation.arguments, {
    cwd: fixtureProject,
    env: { ...process.env, CLUVVI_TEST_BEHAVIOR: JSON.stringify({ mode: "structured-success" }) },
    windowsHide: true,
    timeout: 30_000,
  });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await setBehavior("structured-success");
});

test.beforeEach(async () => {
  await setBehavior("structured-success");
});

test.afterAll(async () => {
  await setBehavior("structured-success");
});

test("operations page exposes structured mode budgets and parser versions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/operations/discovery", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  const selector = page.getByLabel("Structured content parsing");
  await expect(selector).toHaveValue("selected_resources");
  await expect(page.getByTestId("structured-mode-card")).toContainText(
    "HTML and document structure",
  );
  await expect(page.getByTestId("discovery-runtime-summary")).toContainText("selected resources");
  await expect(page.getByTestId("discovery-runtime-summary")).toContainText(
    "@firecrawl/anydoc@0.1.6",
  );
  await selector.selectOption("none");
  await expect(page.getByText("Preview only", { exact: true })).toBeVisible();
  await page.screenshot({
    path: resolve(output, "c1-i5-operations-structured-desktop.png"),
    fullPage: true,
  });
});

test("successful structured parsing renders resources sections tables telemetry and Buyer Map provenance", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await submitMission(page, "repeated approval delays");
  await expect(page.getByTestId("structured-content-running")).toBeVisible({ timeout: 45_000 });
  await page.screenshot({
    path: resolve(output, "c1-i5-structured-running-desktop.png"),
    fullPage: true,
  });
  await waitForStatus(page, "completed");
  const view = page.getByTestId("structured-content-view");
  await expect(view).toBeVisible();
  await expect(view.getByTestId("structured-resource-card")).toHaveCount(2);
  await expect(view.locator('[data-resource-kind="html_page"]')).toHaveCount(1);
  await expect(view.locator('[data-resource-kind="pdf_document"]')).toHaveCount(1);
  await expect(view.getByTestId("structured-section-list").first()).toBeVisible();
  await expect(view.getByTestId("structured-table").first()).toBeVisible();
  await expect(view.getByTestId("content-parse-telemetry-summary")).toContainText(
    "Worker starts: 1",
  );
  await expect(page.getByTestId("project-b-fixture-pipeline")).toContainText("Structured section");
  await page.screenshot({
    path: resolve(output, "c1-i5-structured-success-desktop.png"),
    fullPage: true,
  });
  await view.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: resolve(output, "c1-i5-structured-resource-panel.png"),
    fullPage: false,
  });
});

test("partial structured parsing remains visible with quality limitations", async ({ page }) => {
  await setBehavior("structured-partial");
  await page.setViewportSize({ width: 1280, height: 900 });
  await submitMission(page, "one partially parsed public document");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("structured-content-view");
  await expect(view.getByText("partial", { exact: true })).toBeVisible();
  await expect(view).toContainText(/partial|truncated|limitation/iu);
  await page.screenshot({
    path: resolve(output, "c1-i5-structured-partial-desktop.png"),
    fullPage: true,
  });
});

test("invalid structured artifact fails then resumes with earlier stages reused", async ({
  page,
}) => {
  await setBehavior("structured-private-url");
  await page.setViewportSize({ width: 1280, height: 900 });
  const runId = await submitMission(page, "an unsafe structured target");
  await waitForStatus(page, "failed");
  await expect(page.getByTestId("run-failure")).toContainText(
    "STRUCTURED_CONTENT_PRIVATE_URL_REJECTED",
  );
  await expect(page.getByTestId("structured-content-failure")).toContainText(
    "Repair the structured sidecars",
  );
  await page.screenshot({
    path: resolve(output, "c1-i5-structured-security-failure.png"),
    fullPage: true,
  });

  await setBehavior("structured-success");
  await repairStructuredSidecars(runId);
  await page.getByRole("button", { name: "Resume run" }).click();
  await waitForStatus(page, "completed");
  for (const stage of ["discovery", "frontier", "extraction", "extraction_telemetry"] as const) {
    await expect(page.locator(`[data-stage="${stage}"]`)).toHaveAttribute(
      "data-stage-status",
      "reused",
    );
  }
  await expect(page.getByTestId("structured-content-view")).toBeVisible();
  await page.screenshot({
    path: resolve(output, "c1-i5-structured-resume-reuse.png"),
    fullPage: true,
  });
});

test("mobile structured resource and table views avoid page-level horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await submitMission(page, "mobile structured evidence review");
  await waitForStatus(page, "completed");
  await expect(page.getByTestId("structured-content-view")).toBeVisible();
  await expect(page.getByTestId("structured-table").first()).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
  await page.getByTestId("structured-content-view").screenshot({
    path: resolve(output, "c1-i5-structured-success-mobile.png"),
  });
});

test("execution record marks both structured sidecars imported", async ({ page }) => {
  const runId = await submitMission(page, "auditable structured import provenance");
  await waitForStatus(page, "completed");
  const record = JSON.parse(
    await readFile(
      resolve(browserHome, "runs", runId, "discovery-exchange/discovery-execution.json"),
      "utf8",
    ),
  ) as Record<string, unknown>;
  expect(record["frontierImported"]).toBe(true);
  expect(record["extractedContentImported"]).toBe(true);
  expect(record["extractionTelemetryImported"]).toBe(true);
  expect(record["structuredContentImported"]).toBe(true);
  expect(record["contentParseTelemetryImported"]).toBe(true);
});
