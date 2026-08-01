import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const enabled = process.env.CLUVVI_EXPECT_FAILURE === "1";
const output = resolve(process.cwd(), "visual_qa");

test.skip(!enabled, "Runs only against a runner with CLUVVI_FIXTURE_FAIL_STAGE configured.");

test("browser presents a structured fixture failure and preserves a resumable run", async ({
  page,
}) => {
  await mkdir(output, { recursive: true });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page
    .getByLabel("Describe what you sell or paste your website")
    .fill(
      "AI-assisted video-editing software used to prove a durable browser failure and resume flow.",
    );
  await page.getByRole("button", { name: "Start finding customers" }).click();
  await expect(page).toHaveURL(/\/runs\/run_[a-f0-9]{32}$/);
  const runId = page.url().split("/").at(-1)!;
  const runView = page.locator('[data-testid="run-view"]');
  await expect(runView).toHaveAttribute("data-run-status", "failed", { timeout: 30_000 });
  await expect(page.locator('[data-testid="run-failure"]')).toContainText(
    "SIMULATED_STAGE_FAILURE",
  );
  await expect(page.locator('[data-testid="run-failure"]')).toContainText("investigation");
  await expect(page.getByRole("button", { name: "Resume run" })).toBeVisible();
  await expect(page.locator('[data-stage-status="completed"]')).toHaveCount(5);
  await expect(page.locator('[data-stage-status="failed"]')).toHaveCount(1);
  await page.screenshot({ path: resolve(output, "c05-run-failed-desktop.png"), fullPage: true });
  await writeFile(resolve(output, "c05-failed-run-id.txt"), `${runId}\n`, "utf8");
  expect(pageErrors).toEqual([]);
});
