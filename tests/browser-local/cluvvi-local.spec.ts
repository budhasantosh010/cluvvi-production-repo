import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "visual_qa");

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
});

test("browser creates, completes, refreshes, and inspects one durable fixture run", async ({
  browser,
  page,
  request,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Find who needs what you sell." })).toBeVisible();
  await expect(page.getByText("Local fixture mode:")).toBeVisible();
  await page.screenshot({ path: resolve(output, "c05-home-desktop.png"), fullPage: true });

  const desktopGeometry = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    form: (() => {
      const rect = document.querySelector('[data-testid="mission-form"]')?.getBoundingClientRect();
      return rect ? { left: rect.left, right: rect.right, width: rect.width } : null;
    })(),
  }));
  expect(desktopGeometry.bodyScrollWidth).toBeLessThanOrEqual(desktopGeometry.innerWidth);
  expect(desktopGeometry.form?.right ?? 0).toBeLessThanOrEqual(desktopGeometry.innerWidth);

  await page
    .locator('textarea[name="description"]')
    .fill(
      "AI-assisted video-editing software that creates rough cuts for recurring long-form talking-head video teams.",
    );
  await page.locator('input[name="website"]').fill("https://example.com");
  await page
    .locator('input[name="customerOutcome"]')
    .fill("Content teams publish long-form videos faster with less manual editing.");
  await page
    .locator('textarea[name="exclusions"]')
    .fill("Hobby creators\nInactive channels\nShort-form-only creators");
  await page.getByRole("button", { name: "Run fixture workflow" }).click();
  await expect(page).toHaveURL(/\/runs\/run_[a-f0-9]{32}$/);
  const runUrl = page.url();
  const runId = runUrl.split("/").at(-1)!;
  const runView = page.locator('[data-testid="run-view"]');
  await expect(runView).toHaveAttribute("data-run-status", "completed", { timeout: 30_000 });
  await expect(page.locator('[data-stage-status="completed"]')).toHaveCount(11);
  await expect(page.getByText("Fixture output — not real market data.")).toBeVisible();
  await expect(page.locator('[data-testid="artifact-json"]')).toContainText('"fixture": true');
  await page.screenshot({ path: resolve(output, "c05-run-completed-desktop.png"), fullPage: true });

  await page.reload({ waitUntil: "networkidle" });
  await expect(runView).toHaveAttribute("data-run-status", "completed");
  await expect(page.locator('[data-stage-status="completed"]')).toHaveCount(11);

  const secondPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await secondPage.goto(runUrl, { waitUntil: "networkidle" });
  await expect(secondPage.locator('[data-testid="run-view"]')).toHaveAttribute(
    "data-run-status",
    "completed",
  );
  await secondPage.close();

  const mission = {
    schemaVersion: "1.0",
    name: "Idempotency browser API proof",
    description:
      "A deterministic browser API mission used to prove duplicate submissions return one logical run.",
    geographies: ["Global"],
    desiredOpportunities: 20,
    exclusions: [],
    goodCustomerExamples: [],
    badCustomerExamples: [],
  };
  const idempotencyKey = `playwright_${crypto.randomUUID()}`;
  const first = await request.post("/api/runs", {
    headers: { "Idempotency-Key": idempotencyKey },
    data: mission,
  });
  const duplicate = await request.post("/api/runs", {
    headers: { "Idempotency-Key": idempotencyKey },
    data: mission,
  });
  expect(first.status()).toBe(201);
  expect(duplicate.status()).toBe(200);
  const firstBody = (await first.json()) as { run: { id: string }; created: boolean };
  const duplicateBody = (await duplicate.json()) as { run: { id: string }; created: boolean };
  expect(firstBody.created).toBe(true);
  expect(duplicateBody.created).toBe(false);
  expect(duplicateBody.run.id).toBe(firstBody.run.id);

  const traversal = await request.get(
    `/api/runs/${runId}/artifacts/${encodeURIComponent("../../secret")}`,
  );
  expect(traversal.status()).toBeGreaterThanOrEqual(400);

  await page.goto("/", { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Find who needs what you sell." })).toBeVisible();
  const mobileGeometry = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    controls: [...document.querySelectorAll("input, textarea, select, button")].map((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left: rect.left,
        right: rect.right,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
      };
    }),
  }));
  expect(mobileGeometry.bodyScrollWidth).toBeLessThanOrEqual(mobileGeometry.innerWidth);
  for (const control of mobileGeometry.controls) {
    expect(control.right).toBeLessThanOrEqual(mobileGeometry.innerWidth + 0.5);
    expect(control.left).toBeGreaterThanOrEqual(-0.5);
    expect(control.display).not.toBe("none");
    expect(control.visibility).toBe("visible");
    expect(control.opacity).not.toBe("0");
  }
  await page.screenshot({ path: resolve(output, "c05-home-mobile.png"), fullPage: false });
  await page.screenshot({ path: resolve(output, "c05-home-mobile-full.png"), fullPage: true });
  expect(pageErrors).toEqual([]);
});
