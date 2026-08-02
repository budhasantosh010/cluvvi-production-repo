import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "visual_qa");

async function hideDevelopmentUi(page: Page): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function submitLocalDiscoveryMission(page: Page, description: string): Promise<void> {
  await page.goto("/", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await expect(
    page.getByText("Local Discovery Engine fixture mode", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Describe what you sell or paste your website").fill(description);
  await page.getByTestId("composer-submit").click();
  await expect(page).toHaveURL(/\/runs\/run_[a-f0-9]{32}$/);
}

async function waitForLocalCompletion(page: Page): Promise<void> {
  const runView = page.getByTestId("run-view");
  await expect(runView).toHaveAttribute("data-run-status", "completed", { timeout: 75_000 });
  await expect(page.locator('[data-stage="discovery"]')).toContainText(
    "Ran the local Discovery Engine in fixture-provider mode",
  );
  await expect(page.getByTestId("fixture-provider-warning")).toContainText(
    "This run used the standalone local Discovery Engine with fixture providers. It does not represent live customer discovery.",
  );
  await expect(page.getByText("Local fixture", { exact: true })).toBeVisible();
  const buyerMap = page.getByTestId("project-b-fixture-pipeline");
  await expect(
    buyerMap.getByRole("heading", { name: "Local-engine Fixture Buyer Map" }),
  ).toBeVisible();
  await expect(buyerMap.getByTestId("buyer-map-opportunity").first()).toBeVisible();
}

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

test("real local Discovery Engine bridge completes and preserves artifacts", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await submitLocalDiscoveryMission(
    page,
    "We sell managed AI video editing software for podcast agencies and creator businesses with long-form production backlogs.",
  );

  const discoveryStage = page.locator('[data-stage="discovery"]');
  await expect(discoveryStage).toHaveAttribute("data-stage-status", "running", { timeout: 40_000 });
  await expect(discoveryStage).toContainText(
    "Running the local Discovery Engine in fixture-provider mode",
  );
  await page.screenshot({
    path: resolve(output, "c1-g-local-discovery-running-desktop.png"),
    fullPage: true,
  });

  await waitForLocalCompletion(page);
  await page.screenshot({
    path: resolve(output, "c1-g-local-discovery-complete-desktop.png"),
    fullPage: true,
  });

  const searchResultsTab = page
    .locator("button.artifact-tab")
    .filter({ hasText: "search results" });
  await searchResultsTab.click();
  await expect(page.getByTestId("artifact-json")).toContainText(
    '"artifactKind": "search_results.v2"',
  );
  await expect(page.getByTestId("artifact-json")).toContainText('"providerCategory": "fixture"');
  await page.screenshot({
    path: resolve(output, "c1-g-search-results-artifact.png"),
    fullPage: false,
  });

  await page.getByTestId("project-b-fixture-pipeline").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: resolve(output, "c1-g-buyer-map-local-engine.png"),
    fullPage: false,
  });

  await page.reload({ waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await waitForLocalCompletion(page);
  await expect(page.getByTestId("artifact-json")).toContainText('"artifactKind"');
});

test("local Discovery Engine flow remains usable without mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await submitLocalDiscoveryMission(
    page,
    "We sell AI-assisted rough-cut software for long-form video production teams that need faster editing turnaround.",
  );

  const discoveryStage = page.locator('[data-stage="discovery"]');
  await expect(discoveryStage).toHaveAttribute("data-stage-status", "running", { timeout: 40_000 });
  await page.screenshot({
    path: resolve(output, "c1-g-local-discovery-running-mobile.png"),
    fullPage: true,
  });

  await waitForLocalCompletion(page);
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport);
  await page.screenshot({
    path: resolve(output, "c1-g-local-discovery-complete-mobile.png"),
    fullPage: true,
  });
});
