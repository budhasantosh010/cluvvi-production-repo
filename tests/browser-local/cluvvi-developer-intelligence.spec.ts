import { expect, test, type Page } from "@playwright/test";
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
  process.env["CLUVVI_HOME"]?.trim() || resolve(process.cwd(), ".cluvvi-test/browser-c1-j3");

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
      `We sell video workflow software to businesses. Research ${label} using bounded public GitHub repositories, issues, pull requests, comments, reviews, and release metadata as developer context only. Never infer developer identity, buyer identity, contact identity, representative demand, budget, authority, or purchase intent from GitHub evidence.`,
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
function resolvePnpmInvocation(arguments_: string[]): { command: string; arguments: string[] } {
  if (process.platform !== "win32") return { command: "pnpm", arguments: arguments_ };
  const pathValue = process.env["Path"] ?? process.env["PATH"] ?? "";
  for (const directory of pathValue.split(delimiter)) {
    if (!directory.trim()) continue;
    const shimPath = resolve(directory, "pnpm.cmd");
    if (!existsSync(shimPath)) continue;
    const pnpmCli = resolve(dirname(shimPath), "node_modules", "pnpm", "bin", "pnpm.cjs");
    if (existsSync(pnpmCli))
      return { command: process.execPath, arguments: [pnpmCli, ...arguments_] };
  }
  throw new Error("PNPM CLI not found for C1-J.3 resume proof.");
}
async function repairDeveloperSidecars(runId: string): Promise<void> {
  const exchange = resolve(browserHome, "runs", runId, "discovery-exchange");
  const invocation = resolvePnpmInvocation([
    "discover",
    resolve(exchange, "discovery-request.v1.json"),
    "--provider-mode",
    "fixture_only",
    "--source-adapter-mode",
    "selected_sources",
    "--source-families",
    "developer",
    "--github-depth",
    "default",
    "--github-max-queries",
    "4",
    "--github-max-repositories",
    "8",
    "--github-max-thread-drill",
    "5",
    "--output",
    resolve(exchange, "search-results.v2.json"),
  ]);
  await execFileAsync(invocation.command, invocation.arguments, {
    cwd: fixtureProject,
    env: {
      ...process.env,
      CLUVVI_TEST_BEHAVIOR: JSON.stringify({ mode: "developer-success" }),
    },
    windowsHide: true,
    timeout: 45_000,
  });
}

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await setBehavior("developer-success");
});
test.beforeEach(async () => {
  await setBehavior("developer-success");
});
test.afterAll(async () => {
  await setBehavior("developer-success");
});

test("operations exposes opt-in public GitHub mode, budgets, and hard boundary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/operations/discovery", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await expect(page.getByLabel("Public source adapters")).toHaveValue("selected_sources");
  await expect(page.getByLabel("Source families")).toHaveValue("developer");
  const card = page.getByTestId("developer-mode-card");
  await expect(card).toContainText("Public GitHub intelligence");
  await expect(card).toContainText(/Anonymous by default|token stays inside Project A/iu);
  await expect(card).toContainText(/No private repositories, cloning, mutations/iu);
  await expect(page.getByTestId("discovery-runtime-summary")).toContainText(
    "c1-j3.developer-signals.v1",
  );
  await page.screenshot({
    path: resolve(output, "c1-j3-developer-operations-desktop.png"),
    fullPage: true,
  });
});

test("successful developer run exposes public repos, issue-PR context, signals, zero paid usage, and identity boundary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1360, height: 980 });
  await submitMission(page, "Fixture Frame Studio integration and migration friction");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("developer-intelligence-view");
  await expect(view.getByTestId("developer-repository-card")).toHaveCount(2);
  await expect(view.getByTestId("developer-thread-card")).toHaveCount(2);
  await expect(view.getByTestId("developer-signal-card")).toHaveCount(1);
  await expect(view).toContainText("Developer identity unused");
  await expect(view.getByTestId("developer-telemetry")).toContainText("Paid credits: 0");
  await expect(view).toContainText(/does not prove representative demand|attribution only/iu);
  await view.screenshot({ path: resolve(output, "c1-j3-developer-success.png") });
});

test("rate-limited developer route preserves completed public evidence and exposes degraded telemetry", async ({
  page,
}) => {
  await setBehavior("developer-rate-limited");
  await submitMission(page, "rate-limited public GitHub developer evidence");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("developer-intelligence-view");
  await expect(view.getByTestId("developer-repository-card")).toHaveCount(2);
  await expect(view.getByTestId("developer-signal-card")).toHaveCount(1);
  await expect(view.getByTestId("developer-telemetry")).toContainText("Rate-limit events: 1");
  await expect(view.getByTestId("developer-telemetry")).toContainText("Paid credits: 0");
  await view.screenshot({ path: resolve(output, "c1-j3-developer-rate-limited.png") });
});

test("same-run repair resumes developer analysis and reuses earlier discovery/developer stages", async ({
  page,
}) => {
  await setBehavior("developer-signals-invalid-contract");
  await page.setViewportSize({ width: 1360, height: 950 });
  const runId = await submitMission(page, "same-run GitHub developer analysis repair");
  await waitForStatus(page, "failed");
  await expect(page.getByTestId("run-failure")).toContainText("DEVELOPER_SIGNALS_INVALID");
  await expect(page.getByTestId("developer-intelligence-failure")).toContainText(
    /Earlier discovery, hiring, community, and completed developer stages remain reusable/iu,
  );
  await setBehavior("developer-success");
  await repairDeveloperSidecars(runId);
  await page.getByRole("button", { name: "Resume run" }).click();
  await waitForStatus(page, "completed");
  for (const stage of [
    "discovery",
    "developer_planning",
    "developer_repository_retrieval",
    "developer_thread_retrieval",
    "developer_thread_context",
    "developer_comment_retrieval",
    "developer_comment_context",
  ] as const) {
    await expect(page.locator(`[data-stage="${stage}"]`)).toHaveAttribute(
      "data-stage-status",
      "reused",
    );
  }
  await expect(page.getByTestId("developer-intelligence-view")).toBeVisible();
  await page.screenshot({
    path: resolve(output, "c1-j3-developer-resume-reuse.png"),
    fullPage: true,
  });
});

test("Buyer Map preserves GitHub provenance and separately caps developer contribution at +1", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await submitMission(page, "Fixture Frame Studio repeated developer integration problems");
  await waitForStatus(page, "completed");
  const buyerMap = page.getByTestId("project-b-fixture-pipeline");
  await expect(page.getByTestId("buyer-map-github-repository-count")).toContainText(/[1-9]/u);
  await expect(page.getByTestId("buyer-map-github-thread-count")).toContainText(/[1-9]/u);
  await expect(page.getByTestId("buyer-map-github-comment-count")).toContainText(/[1-9]/u);
  await expect(page.getByTestId("buyer-map-github-release-count")).toContainText(/[1-9]/u);
  await expect(page.getByTestId("buyer-map-developer-signal-count")).toContainText(/[1-9]/u);
  await expect(page.getByTestId("buyer-map-developer-provenance").first()).toContainText(
    /fixture-frame\/studio|fixture-labs\/frame-plugin/iu,
  );
  await expect(page.getByTestId("buyer-map-developer-ranking").first()).toContainText("+1 / 1 max");
  await expect(buyerMap).toContainText(/contact identity|attribution only/iu);
  await buyerMap.screenshot({ path: resolve(output, "c1-j3-buyer-map-developer.png") });
});

test("mobile GitHub developer cards and operations page have no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations/discovery", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await expect(page.getByTestId("developer-mode-card")).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(output, "c1-j3-developer-operations-mobile.png"),
    fullPage: true,
  });
  await submitMission(page, "mobile public GitHub developer evidence");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("developer-intelligence-view");
  await expect(view).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await view.screenshot({ path: resolve(output, "c1-j3-developer-mobile.png") });
});
