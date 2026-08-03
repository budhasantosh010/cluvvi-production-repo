import { expect, test, type Page } from "@playwright/test";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "visual_qa");
const behaviorPath = resolve(process.cwd(), "tests/fixtures/local-discovery-engine/behavior.json");
const successBehavior = `${JSON.stringify({ mode: "success" }, null, 2)}\n`;

type FreeBehavior =
  | "free-ddg-success"
  | "free-ddg-insufficient"
  | "partial-live"
  | "all-free-fail"
  | "policy-trace-invalid-json";

async function hideDevelopmentUi(page: Page): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function setBehavior(mode: FreeBehavior): Promise<void> {
  await writeFile(behaviorPath, `${JSON.stringify({ mode }, null, 2)}\n`, "utf8");
}

async function submitMission(page: Page, description: string): Promise<string> {
  await page.goto("/", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await expect(page.getByText("Local live search · free only", { exact: true })).toBeVisible();
  await page.getByLabel("Describe what you sell or paste your website").fill(description);
  await page.getByTestId("composer-submit").click();
  await expect(page).toHaveURL(/\/runs\/(run_[a-f0-9]{32})$/, { timeout: 20_000 });
  const match = /\/runs\/(run_[a-f0-9]{32})$/.exec(page.url());
  if (match?.[1] === undefined) throw new Error("Run ID was not present in the URL.");
  return match[1];
}

async function waitForFreeCompletion(page: Page): Promise<void> {
  await expect(page.getByTestId("run-view")).toHaveAttribute("data-run-status", "completed", {
    timeout: 80_000,
  });
  await expect(page.getByTestId("fixture-provider-warning")).toContainText("Free only");
  await expect(page.getByTestId("fixture-provider-warning")).toContainText(
    "Paid providers were blocked by policy",
  );
  await expect(page.getByTestId("provider-policy-trace")).toBeVisible();
  await expect(page.getByTestId("provider-policy-trace")).toContainText(
    "Free only provider ladder",
  );
  await expect(page.getByTestId("provider-policy-trace")).toContainText("Search snippets only");
  await expect(page.getByTestId("provider-policy-trace")).toContainText(
    "Full pages were not extracted",
  );
  await expect(page.getByTestId("provider-policy-trace")).toContainText(
    "Coverage may be incomplete",
  );
  await expect(
    page.getByTestId("project-b-fixture-pipeline").getByRole("heading", {
      name: "Live-search Buyer Map",
    }),
  ).toBeVisible();
  await expect(
    page.getByTestId("project-b-fixture-pipeline").getByTestId("buyer-map-opportunity").first(),
  ).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport);
}

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

test.afterAll(async () => {
  await writeFile(behaviorPath, successBehavior, "utf8");
});

test.describe.serial("C1-HF free-only browser flows", () => {
  test("free-only desktop shows zero-paid policy and skips Startpage after sufficient DuckDuckGo coverage", async ({
    page,
  }) => {
    await setBehavior("free-ddg-success");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await submitMission(
      page,
      "We sell managed AI video editing software for creator teams with slow turnaround and manual workflow problems.",
    );
    await waitForFreeCompletion(page);
    const ladder = page.getByTestId("provider-ladder");
    await expect(ladder).toContainText("Attempt 1");
    await expect(ladder).toContainText("searxng search");
    await expect(ladder).toContainText("SearXNG is unconfigured");
    await expect(ladder).toContainText("Attempt 2");
    await expect(ladder).toContainText("duckduckgo html search");
    await expect(ladder).toContainText("Attempt 3");
    await expect(ladder).toContainText("startpage html search");
    await expect(ladder).toContainText("Free coverage was sufficient after DuckDuckGo");
    await expect(page.getByTestId("live-provider-telemetry")).toContainText("Tavily credits");
    await expect(page.getByTestId("live-provider-telemetry")).toContainText("Brave requests");
    await page.screenshot({
      path: resolve(output, "c1-hf-free-only-desktop.png"),
      fullPage: true,
    });
  });

  test("free-only mobile remains usable without horizontal overflow", async ({ page }) => {
    await setBehavior("free-ddg-success");
    await page.setViewportSize({ width: 390, height: 844 });
    await submitMission(
      page,
      "We sell AI-assisted rough-cut software for podcast agencies with editing backlogs.",
    );
    await waitForFreeCompletion(page);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: resolve(output, "c1-hf-free-only-mobile.png"),
      fullPage: true,
    });
  });

  test("free partial-provider failure remains an honest successful partial run", async ({
    page,
  }) => {
    await setBehavior("partial-live");
    await page.setViewportSize({ width: 1280, height: 960 });
    await submitMission(
      page,
      "We sell video editing workflow software for agencies experiencing capacity problems.",
    );
    await waitForFreeCompletion(page);
    await expect(page.getByTestId("live-provider-telemetry")).toContainText(
      "Partial provider coverage",
    );
    await expect(page.getByTestId("provider-ladder")).toContainText("DDG_CHALLENGE_DETECTED");
    await page.screenshot({
      path: resolve(output, "c1-hf-free-partial-provider-failure.png"),
      fullPage: true,
    });
  });

  test("free all-provider failure blocks downstream output", async ({ page }) => {
    await setBehavior("all-free-fail");
    await page.setViewportSize({ width: 1280, height: 960 });
    await submitMission(
      page,
      "We sell video editing workflow software for agencies with production bottlenecks.",
    );
    await expect(page.getByTestId("run-view")).toHaveAttribute("data-run-status", "failed", {
      timeout: 60_000,
    });
    await expect(page.getByTestId("run-failure")).toContainText("DISCOVERY_ENGINE_COMMAND_FAILED");
    await expect(page.getByTestId("project-b-fixture-pipeline")).toHaveCount(0);
    await page.screenshot({
      path: resolve(output, "c1-hf-free-all-provider-failure.png"),
      fullPage: true,
    });
  });

  test("invalid free policy trace preserves diagnostics and resumes the same run", async ({
    page,
  }) => {
    await setBehavior("policy-trace-invalid-json");
    await page.setViewportSize({ width: 1280, height: 960 });
    const runId = await submitMission(
      page,
      "We sell AI video editing software for podcast agencies with manual production workflows.",
    );
    await expect(page.getByTestId("run-view")).toHaveAttribute("data-run-status", "failed", {
      timeout: 60_000,
    });
    await expect(page.getByTestId("run-failure")).toContainText("PROVIDER_POLICY_TRACE_INVALID");
    await expect(page.getByTestId("project-b-fixture-pipeline")).toHaveCount(0);

    const cluvviHome = process.env["CLUVVI_HOME"];
    if (cluvviHome === undefined)
      throw new Error("CLUVVI_HOME is required for this browser proof.");
    const exchange = resolve(cluvviHome, "runs", runId, "discovery-exchange");
    await access(resolve(exchange, "search-results.v2.json.provider-policy-trace.v1.json"));
    const execution = JSON.parse(
      await readFile(resolve(exchange, "discovery-execution.json"), "utf8"),
    ) as { errorCode?: unknown; providerPolicy?: unknown; success?: unknown };
    expect(execution.errorCode).toBe("PROVIDER_POLICY_TRACE_INVALID");
    expect(execution.providerPolicy).toBe("free_only");
    expect(execution.success).toBe(false);

    await setBehavior("free-ddg-success");
    await page.getByRole("button", { name: "Resume run" }).click();
    await waitForFreeCompletion(page);
    await expect(page).toHaveURL(new RegExp(`/runs/${runId}$`));
    await page.screenshot({
      path: resolve(output, "c1-hf-free-failure-resumed.png"),
      fullPage: true,
    });
  });
});
