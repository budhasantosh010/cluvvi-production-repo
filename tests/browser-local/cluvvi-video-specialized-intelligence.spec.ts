import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "visual_qa");
const fixtureProject =
  process.env["CLUVVI_DISCOVERY_FIXTURE_PATH"]?.trim() ||
  resolve(process.cwd(), "tests/fixtures/local-discovery-engine");
const behaviorPath = resolve(fixtureProject, "behavior.json");

async function setBehavior(mode: string) {
  await writeFile(behaviorPath, `${JSON.stringify({ mode }, null, 2)}\n`, "utf8");
}
async function hideDevUi(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}
async function submit(page: Page, label: string) {
  await page.goto("/", { waitUntil: "networkidle" });
  await hideDevUi(page);
  await page
    .getByLabel("Describe what you sell or paste your website")
    .fill(
      `We sell video workflow software. Research ${label} with bounded public YouTube text and specialized public sources. Creator, commenter, publisher, and source identities are attribution only; do not infer buyer/contact identity, budget, authority, purchase intent, or representative demand.`,
    );
  await page.getByTestId("composer-submit").click();
  await expect(page).toHaveURL(/\/runs\/run_[a-f0-9]{32}$/u);
  await expect(page.getByTestId("run-view")).toHaveAttribute("data-run-status", "completed", {
    timeout: 90_000,
  });
}
async function noOverflow(page: Page) {
  const w = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(w.document).toBeLessThanOrEqual(w.viewport);
  expect(w.body).toBeLessThanOrEqual(w.viewport);
}

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await setBehavior("video-specialized-success");
});
test.beforeEach(async () => {
  await setBehavior("video-specialized-success");
});
test.afterAll(async () => {
  await setBehavior("video-specialized-success");
});

test("operations exposes C1-J.4 video and C1-J.5 specialized boundaries", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/operations/discovery", { waitUntil: "networkidle" });
  await hideDevUi(page);
  await expect(page.getByLabel("Source families")).toHaveValue("video_specialized");
  await expect(page.getByTestId("video-mode-card")).toContainText(
    /Public YouTube intelligence|No media download/iu,
  );
  await expect(page.getByTestId("specialized-mode-card")).toContainText(
    /Universal industry intelligence|specialized, not research|arXiv, Techmeme/iu,
  );
  const summary = page.getByTestId("discovery-runtime-summary");
  await expect(summary).toContainText("c1-j4.video-signals.v1");
  await expect(summary).toContainText("c1-j5.specialized-signals.v1");
  await expect(summary).toContainText("c1-j5.0");
  await expect(page.locator("body")).not.toContainText(
    "DISCOVERY_SPECIALIZED_SOURCE_REGISTRY_PATH",
  );
  await noOverflow(page);
  await page.screenshot({ path: resolve(output, "c1-j45-operations-desktop.png"), fullPage: true });
});

test("combined run shows separate video/specialized evidence and ranking caps on desktop and mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1360, height: 980 });
  await submit(page, "Fixture Frame Studio workflow friction");
  const video = page.getByTestId("video-intelligence-view");
  const specialized = page.getByTestId("specialized-intelligence-view");
  await expect(video.getByTestId("video-card")).toHaveCount(2);
  await expect(video.getByTestId("video-signal-card")).toHaveCount(1);
  await expect(video.getByTestId("video-telemetry")).toContainText("Paid credits: 0");
  await expect(video).toContainText("Creator/commenter identity unused");
  await expect(specialized.getByTestId("specialized-source-card")).toHaveCount(2);
  await expect(specialized.getByTestId("specialized-finding-card")).toHaveCount(2);
  await expect(specialized.getByTestId("specialized-signal-card")).toHaveCount(1);
  await expect(specialized.getByTestId("specialized-telemetry")).toContainText("Paid credits: 0");
  await expect(specialized).toContainText("Publisher/source identity only");
  for (const id of [
    "buyer-map-video-count",
    "buyer-map-video-signal-count",
    "buyer-map-specialized-finding-count",
    "buyer-map-specialized-signal-count",
  ])
    await expect(page.getByTestId(id)).toContainText(/[1-9]/u);
  await expect(page.getByTestId("buyer-map-video-ranking").first()).toContainText("+1 / 1 max");
  await expect(page.getByTestId("buyer-map-specialized-ranking").first()).toContainText(
    "+1 / 1 max",
  );
  await page.screenshot({ path: resolve(output, "c1-j45-combined-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await hideDevUi(page);
  await noOverflow(page);
  await expect(page.getByTestId("video-intelligence-view")).toBeVisible();
  await expect(page.getByTestId("specialized-intelligence-view")).toBeVisible();
  await page.screenshot({ path: resolve(output, "c1-j45-combined-mobile.png"), fullPage: true });
});
