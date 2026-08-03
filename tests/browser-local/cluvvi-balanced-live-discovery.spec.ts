import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "visual_qa");
const behaviorPath = resolve(process.cwd(), "tests/fixtures/local-discovery-engine/behavior.json");
const successBehavior = `${JSON.stringify({ mode: "success" }, null, 2)}\n`;

async function hideDevelopmentUi(page: Page): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function submitMission(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await expect(page.getByText("Local live search · balanced", { exact: true })).toBeVisible();
  await page
    .getByLabel("Describe what you sell or paste your website")
    .fill("We sell AI video editing workflow software for agencies with editing backlogs.");
  await page.getByTestId("composer-submit").click();
  await expect(page).toHaveURL(/\/runs\/run_[a-f0-9]{32}$/, { timeout: 20_000 });
}

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await writeFile(
    behaviorPath,
    `${JSON.stringify({ mode: "balanced-fallback" }, null, 2)}\n`,
    "utf8",
  );
});

test.afterAll(async () => {
  await writeFile(behaviorPath, successBehavior, "utf8");
});

test("balanced policy shows free-first insufficiency and the persisted paid fallback reason", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await submitMission(page);
  await expect(page.getByTestId("run-view")).toHaveAttribute("data-run-status", "completed", {
    timeout: 80_000,
  });
  await expect(page.getByTestId("fixture-provider-warning")).toContainText("Balanced");
  await expect(page.getByTestId("provider-policy-trace")).toContainText(
    "Free coverage was below the configured threshold",
  );
  await expect(page.getByTestId("provider-policy-trace")).toContainText("Paid fallback");
  await expect(page.getByTestId("provider-policy-trace")).toContainText(
    "Accepted results 1 are below 5",
  );
  const ladder = page.getByTestId("provider-ladder");
  await expect(ladder).toContainText("Attempt 1");
  await expect(ladder).toContainText("startpage html search");
  await expect(ladder).toContainText("insufficient coverage");
  await expect(ladder).toContainText("Attempt 2");
  await expect(ladder).toContainText("brave web search");
  await expect(
    page.getByTestId("project-b-fixture-pipeline").getByRole("heading", {
      name: "Live-search Buyer Map",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(output, "c1-hf-balanced-paid-fallback.png"),
    fullPage: true,
  });
});
