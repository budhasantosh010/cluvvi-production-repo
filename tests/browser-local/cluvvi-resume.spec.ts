import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const enabled = process.env.CLUVVI_EXPECT_RESUME === "1";
const output = resolve(process.cwd(), "visual_qa");

test.skip(!enabled, "Runs only after the failure fixture browser proof.");

test("browser resumes the failed run and reuses completed durable stages", async ({ page }) => {
  const runId = (await readFile(resolve(output, "c05-failed-run-id.txt"), "utf8")).trim();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/runs/${runId}`, { waitUntil: "networkidle" });
  await expect(page.locator('[data-testid="run-view"]')).toHaveAttribute(
    "data-run-status",
    "failed",
  );
  await page.getByRole("button", { name: "Resume run" }).click();
  await expect(page.locator('[data-testid="run-view"]')).toHaveAttribute(
    "data-run-status",
    "completed",
    {
      timeout: 30_000,
    },
  );
  await expect(page.locator('[data-stage-status="reused"]')).toHaveCount(5);
  await expect(page.locator('[data-stage-status="completed"]')).toHaveCount(6);
  await expect(page.locator('[data-testid="artifact-json"]')).toContainText('"fixture": true');
  await page.screenshot({ path: resolve(output, "c05-run-resumed-desktop.png"), fullPage: true });
});
