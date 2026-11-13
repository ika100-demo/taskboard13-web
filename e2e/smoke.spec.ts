import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

test.skip(!process.env.SMOKE_BASE_URL, "SMOKE_BASE_URL not set");

// Read-only, so it runs in every environment. A smoke test that creates or changes data also carries
// @writes in its title (or { tag: "@writes" }) and then runs only in dev (#474).

test("the root page loads at the base URL @smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Task board" })).toBeVisible();
  await expect(page.getByText("Tasks could not be loaded. Please try again.")).toHaveCount(0);
});

test("the start page lists the tasks or says there are none @smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Task board" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Tasks" }).or(page.getByText("No tasks yet"))).toBeVisible();
  await expect(page.getByText("Tasks could not be loaded. Please try again.")).toHaveCount(0);
});

test("a task added on the start page appears at the end of the list @smoke @writes", async ({ page }) => {
  const title = `smoke-${randomUUID()}`;
  await page.goto("/");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Add task" }).click();
  const items = page.getByRole("list", { name: "Tasks" }).getByRole("listitem");
  await expect(items.last()).toContainText(title);
  await expect(items.last()).toContainText("No due date");
});
