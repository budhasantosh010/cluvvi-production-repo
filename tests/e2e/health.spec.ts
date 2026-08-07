import { expect, test } from "@playwright/test";

test("web health endpoint is truthful and secret-free", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body).toMatchObject({
    status: "ok",
    web: "ok",
    database: "ok",
    mode: "fixture",
  });
  expect(body.databaseInstanceId).toEqual(expect.any(String));
  expect(JSON.stringify(body)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
});
