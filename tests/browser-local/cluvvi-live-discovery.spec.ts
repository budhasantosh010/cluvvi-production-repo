import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "visual_qa");

async function hideDevelopmentUi(page: Page): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function submitLiveMission(page: Page, description: string): Promise<void> {
  await page.goto("/", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await expect(page.getByText("Local live search · paid deep", { exact: true })).toBeVisible();
  await page.getByLabel("Describe what you sell or paste your website").fill(description);
  await page.getByTestId("composer-submit").click();
  await expect(page).toHaveURL(/\/runs\/run_[a-f0-9]{32}$/, { timeout: 20_000 });
}

async function waitForLiveCompletion(page: Page): Promise<void> {
  const runView = page.getByTestId("run-view");
  await expect(runView).toHaveAttribute("data-run-status", "completed", { timeout: 100_000 });
  await expect(page.locator('[data-stage="discovery"]')).toContainText(
    "Imported and validated live search results, provider telemetry, and policy trace",
  );
  await expect(page.getByTestId("fixture-provider-warning")).toContainText(
    "explicit paid-deep search routing",
  );
  await expect(page.getByTestId("provider-policy-trace")).toContainText(
    "Paid providers were permitted for this run",
  );
  await expect(page.getByTestId("live-provider-telemetry")).toBeVisible();
  await expect(page.getByTestId("live-provider-list")).toContainText(
    /tavily search|brave web search/i,
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

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

test("real live Discovery Engine bridge completes with telemetry and Buyer Map", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await submitLiveMission(
    page,
    "We sell managed AI video editing software for podcast agencies and creator businesses with long-form production backlogs, workflow automation problems, and slow turnaround.",
  );

  const discoveryStage = page.locator('[data-stage="discovery"]');
  await expect(discoveryStage).toHaveAttribute("data-stage-status", "running", { timeout: 45_000 });
  await expect(discoveryStage).toContainText(
    "Running provider-policy-controlled search through the local Discovery Engine",
  );
  await page.screenshot({
    path: resolve(output, "c1-h-live-discovery-running-desktop.png"),
    fullPage: true,
  });

  await waitForLiveCompletion(page);
  await page.screenshot({
    path: resolve(output, "c1-h-live-discovery-complete-desktop.png"),
    fullPage: true,
  });

  const searchResultsTab = page
    .locator("button.artifact-tab")
    .filter({ hasText: "search results" });
  await searchResultsTab.click();
  const artifactJson = page.getByTestId("artifact-json");
  await expect(artifactJson).toContainText('"artifactKind": "search_results.v2"');
  await expect(artifactJson).not.toContainText('"providerCategory": "fixture"');
  await expect(artifactJson).not.toContainText(".invalid");
  await page.screenshot({
    path: resolve(output, "c1-h-live-search-results-artifact.png"),
    fullPage: false,
  });

  await page.getByTestId("live-provider-telemetry").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: resolve(output, "c1-h-live-provider-telemetry.png"),
    fullPage: false,
  });

  await page.getByTestId("project-b-fixture-pipeline").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: resolve(output, "c1-h-live-buyer-map.png"),
    fullPage: false,
  });

  await page.reload({ waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await waitForLiveCompletion(page);
});

test("live Discovery Engine flow remains usable without mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await submitLiveMission(
    page,
    "We sell AI-assisted rough-cut software for long-form video teams that need faster editing turnaround and better workflow automation.",
  );

  await expect(page.locator('[data-stage="discovery"]')).toHaveAttribute(
    "data-stage-status",
    "running",
    { timeout: 45_000 },
  );
  await page.screenshot({
    path: resolve(output, "c1-h-live-discovery-running-mobile.png"),
    fullPage: true,
  });

  await waitForLiveCompletion(page);
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport);
  await page.screenshot({
    path: resolve(output, "c1-h-live-discovery-complete-mobile.png"),
    fullPage: true,
  });
});
