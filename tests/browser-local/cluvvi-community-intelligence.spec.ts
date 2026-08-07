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
  process.env["CLUVVI_HOME"]?.trim() || resolve(process.cwd(), ".cluvvi-test/browser-c1-j2");
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
      `We sell video workflow software to businesses. Research ${label} using bounded public Reddit discussion as anecdotal context only. Never infer buyer identity, budget, authority, representative demand, or purchase intent from community posts.`,
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
  throw new Error("PNPM CLI not found for C1-J.2 resume proof.");
}
async function repairCommunitySidecars(runId: string): Promise<void> {
  const exchange = resolve(browserHome, "runs", runId, "discovery-exchange");
  const invocation = resolvePnpmInvocation([
    "discover",
    resolve(exchange, "discovery-request.v1.json"),
    "--provider-mode",
    "fixture_only",
    "--source-adapter-mode",
    "selected_sources",
    "--source-families",
    "community",
    "--reddit-depth",
    "default",
    "--reddit-max-queries",
    "4",
    "--reddit-max-subreddits",
    "6",
    "--reddit-max-threads",
    "20",
    "--reddit-max-thread-drill",
    "5",
    "--output",
    resolve(exchange, "search-results.v2.json"),
  ]);
  await execFileAsync(invocation.command, invocation.arguments, {
    cwd: fixtureProject,
    env: { ...process.env, CLUVVI_TEST_BEHAVIOR: JSON.stringify({ mode: "community-success" }) },
    windowsHide: true,
    timeout: 45_000,
  });
}

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await setBehavior("community-success");
});
test.beforeEach(async () => {
  await setBehavior("community-success");
});
test.afterAll(async () => {
  await setBehavior("community-success");
});

test("operations exposes opt-in keyless community mode, budgets, and hard boundary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/operations/discovery", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await expect(page.getByLabel("Public source adapters")).toHaveValue("selected_sources");
  await expect(page.getByLabel("Source families")).toHaveValue("community");
  await expect(page.getByTestId("community-mode-card")).toContainText(
    "Keyless public Reddit intelligence",
  );
  await expect(page.getByTestId("community-mode-card")).toContainText(
    /No Reddit login, OAuth, cookies, paid API, or challenge bypass/iu,
  );
  await expect(page.getByTestId("discovery-runtime-summary")).toContainText(
    "community_signals@1.0.0",
  );
  await page.screenshot({
    path: resolve(output, "c1-j2-community-operations-desktop.png"),
    fullPage: true,
  });
});

test("successful community run exposes threads, comments, signals, telemetry, and no paid usage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1360, height: 950 });
  await submitMission(page, "Fixture Frame Studio editing workflow pain and alternatives");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("community-intelligence-view");
  await expect(view.getByTestId("community-thread-card")).toHaveCount(2);
  await expect(view.getByTestId("community-comment-card")).toHaveCount(1);
  await expect(view.getByTestId("community-signal-card")).toHaveCount(1);
  await expect(view.getByTestId("community-telemetry")).toContainText("Paid requests: 0");
  await expect(view).toContainText(/anecdotal|does not prove representative demand/iu);
  await view.screenshot({ path: resolve(output, "c1-j2-community-success.png") });
});

test("RSS-only community evidence keeps engagement explicitly unknown", async ({ page }) => {
  await setBehavior("community-rss-only");
  await submitMission(page, "RSS-only public community discussion");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("community-intelligence-view");
  await expect(view.getByTestId("community-engagement-state").first()).toContainText(
    "Engagement unknown",
  );
  await view.screenshot({ path: resolve(output, "c1-j2-community-rss-unknown-engagement.png") });
});

test("Arctic-backed engagement is labeled as archived and possibly stale", async ({ page }) => {
  await setBehavior("community-arctic");
  await submitMission(page, "Arctic-backed public community engagement");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("community-intelligence-view");
  await expect(view.getByTestId("community-engagement-state").first()).toContainText(
    /arctic shift archive|possibly stale/iu,
  );
  await view.screenshot({ path: resolve(output, "c1-j2-community-arctic-stale.png") });
});

test("partial Shreddit challenge preserves RSS evidence and shows no bypass", async ({ page }) => {
  await setBehavior("community-partial");
  await submitMission(page, "partial Reddit challenge with RSS fallback");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("community-intelligence-view");
  await expect(view.getByTestId("community-thread-card")).toHaveCount(2);
  await expect(view.getByTestId("community-telemetry")).toContainText("Challenges: 1");
  await expect(view.getByTestId("community-telemetry")).toContainText(/never bypassed/iu);
  await view.screenshot({ path: resolve(output, "c1-j2-community-partial-challenge.png") });
});

test("all-unavailable community routes complete honestly with zero invented evidence", async ({
  page,
}) => {
  await setBehavior("community-all-unavailable");
  await submitMission(page, "all unavailable public Reddit routes");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("community-intelligence-view");
  await expect(view.getByTestId("community-thread-card")).toHaveCount(0);
  await expect(view.getByTestId("community-signal-card")).toHaveCount(0);
  await expect(view.getByTestId("community-telemetry")).toContainText("Challenges: 1");
  await expect(view.getByTestId("community-telemetry")).toContainText("Paid requests: 0");
  await view.screenshot({ path: resolve(output, "c1-j2-community-all-unavailable.png") });
});

test("ambiguous community entity evidence does not create Buyer Map citations or rank boost", async ({
  page,
}) => {
  await setBehavior("community-ambiguous");
  await submitMission(page, "ambiguous unrelated broad subreddit evidence");
  await waitForStatus(page, "completed");
  await expect(page.getByTestId("buyer-map-reddit-thread-count")).toContainText("0");
  await expect(page.getByTestId("buyer-map-community-signal-count")).toContainText("0");
  await expect(page.getByTestId("buyer-map-community-ranking").first()).toContainText("+0 / 1 max");
});

test("invalid community signal artifact fails at analysis without leaking forbidden content", async ({
  page,
}) => {
  await setBehavior("community-invalid-signals");
  await page.setViewportSize({ width: 1280, height: 900 });
  await submitMission(page, "a malformed community signal sidecar");
  await waitForStatus(page, "failed");
  await expect(page.getByTestId("run-failure")).toContainText("COMMUNITY_SIGNALS_INVALID");
  await expect(page.getByTestId("community-intelligence-failure")).toContainText(
    /Earlier durable discovery and completed community stages remain reusable/iu,
  );
  await page.screenshot({
    path: resolve(output, "c1-j2-community-invalid-artifact.png"),
    fullPage: true,
  });
});

test("same-run repair resumes community analysis and reuses earlier discovery/community stages", async ({
  page,
}) => {
  await setBehavior("community-invalid-signals");
  await page.setViewportSize({ width: 1360, height: 950 });
  const runId = await submitMission(page, "same-run community analysis repair");
  await waitForStatus(page, "failed");
  await setBehavior("community-success");
  await repairCommunitySidecars(runId);
  await page.getByRole("button", { name: "Resume run" }).click();
  await waitForStatus(page, "completed");
  for (const stage of [
    "discovery",
    "community_planning",
    "community_retrieval",
    "community_thread_context",
    "community_comment_retrieval",
    "community_comment_context",
  ] as const) {
    await expect(page.locator(`[data-stage="${stage}"]`)).toHaveAttribute(
      "data-stage-status",
      "reused",
    );
  }
  await expect(page.getByTestId("community-intelligence-view")).toBeVisible();
  await page.screenshot({
    path: resolve(output, "c1-j2-community-resume-reuse.png"),
    fullPage: true,
  });
});

test("Buyer Map shows Reddit provenance, anecdotal caveat, and capped community contribution", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await submitMission(page, "Fixture Frame Studio repeated editing workflow pain");
  await waitForStatus(page, "completed");
  const buyerMap = page.getByTestId("project-b-fixture-pipeline");
  await expect(page.getByTestId("buyer-map-reddit-thread-count")).toContainText(/[1-9]/u);
  await expect(page.getByTestId("buyer-map-community-signal-count")).toContainText(/[1-9]/u);
  await expect(page.getByTestId("buyer-map-community-provenance").first()).toContainText(
    /r\/videoediting/iu,
  );
  await expect(page.getByTestId("buyer-map-community-ranking").first()).toContainText(/\/ 1 max/iu);
  await expect(buyerMap).toContainText(/does not prove representative demand|anecdotal/iu);
  await buyerMap.screenshot({ path: resolve(output, "c1-j2-buyer-map-community.png") });
});

test("mobile community cards and operations page have no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations/discovery", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await expect(page.getByTestId("community-mode-card")).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(output, "c1-j2-community-operations-mobile.png"),
    fullPage: true,
  });
  await submitMission(page, "mobile public Reddit workflow evidence");
  await waitForStatus(page, "completed");
  const view = page.getByTestId("community-intelligence-view");
  await expect(view).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await view.screenshot({ path: resolve(output, "c1-j2-community-mobile.png") });
});
