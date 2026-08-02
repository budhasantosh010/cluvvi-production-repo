import { expect, test, type Page } from "@playwright/test";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "visual_qa");
const behaviorPath = resolve(process.cwd(), "tests/fixtures/local-discovery-engine/behavior.json");
const successBehavior = `${JSON.stringify({ mode: "success" }, null, 2)}\n`;

async function hideDevelopmentUi(page: Page): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function setBehavior(mode: "success" | "invalid-json"): Promise<void> {
  await writeFile(behaviorPath, `${JSON.stringify({ mode }, null, 2)}\n`, "utf8");
}

test.beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await setBehavior("invalid-json");
});

test.afterAll(async () => {
  await writeFile(behaviorPath, successBehavior, "utf8");
});

test("invalid local output fails honestly and resume succeeds after correction", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto("/", { waitUntil: "networkidle" });
  await hideDevelopmentUi(page);
  await page
    .getByLabel("Describe what you sell or paste your website")
    .fill("We sell AI video editing software for podcast agencies with production backlogs.");
  await page.getByTestId("composer-submit").click();
  await expect(page).toHaveURL(/\/runs\/(run_[a-f0-9]{32})$/, { timeout: 20_000 });
  const match = /\/runs\/(run_[a-f0-9]{32})$/.exec(page.url());
  if (match?.[1] === undefined) throw new Error("Run ID was not present in the URL.");
  const runId = match[1];

  await expect(page.getByTestId("run-view")).toHaveAttribute("data-run-status", "failed", {
    timeout: 60_000,
  });
  await expect(page.getByTestId("run-failure")).toContainText(
    "DISCOVERY_ENGINE_OUTPUT_INVALID_JSON",
  );
  await expect(page.getByTestId("run-failure")).toContainText(
    "The local Discovery Engine output is not valid JSON.",
  );
  await expect(page.getByTestId("project-b-fixture-pipeline")).toHaveCount(0);
  const cluvviHome = process.env["CLUVVI_HOME"];
  if (cluvviHome === undefined) throw new Error("CLUVVI_HOME is required for this browser proof.");
  const exchange = resolve(cluvviHome, "runs", runId, "discovery-exchange");
  await access(resolve(exchange, "discovery-request.v1.json"));
  await access(resolve(exchange, "search-results.v2.json"));
  const execution = JSON.parse(
    await readFile(resolve(exchange, "discovery-execution.json"), "utf8"),
  ) as { errorCode?: unknown; success?: unknown };
  expect(execution.errorCode).toBe("DISCOVERY_ENGINE_OUTPUT_INVALID_JSON");
  expect(execution.success).toBe(false);
  await page.screenshot({
    path: resolve(output, "c1-g-local-discovery-failure.png"),
    fullPage: true,
  });

  await setBehavior("success");
  await page.getByRole("button", { name: "Resume run" }).click();
  await expect(page.getByTestId("run-view")).toHaveAttribute("data-run-status", "completed", {
    timeout: 60_000,
  });
  await expect(page.locator('[data-stage="discovery"]')).toContainText(
    "Ran the local Discovery Engine in fixture-provider mode",
  );
  await expect(page.getByTestId("fixture-provider-warning")).toContainText(
    "It does not represent live customer discovery.",
  );
  await expect(page.getByTestId("project-b-fixture-pipeline")).toBeVisible();
  await page.screenshot({
    path: resolve(output, "c1-g-local-discovery-resumed.png"),
    fullPage: true,
  });
});
