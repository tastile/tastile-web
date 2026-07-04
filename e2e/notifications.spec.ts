import { expect, test } from "@playwright/test";

test("execution start creates in-app and browser notifications", async ({ page }) => {
  const title = `E2E notification tile ${Date.now()}`;
  await page.addInitScript(() => {
    const notifications: Array<{ title: string; body?: string; tag?: string }> = [];
    class MockNotification {
      static permission: NotificationPermission = "granted";
      static requestPermission = async () => "granted" as NotificationPermission;
      title: string;
      body?: string;
      tag?: string;
      onclick: (() => void) | null = null;
      constructor(title: string, options?: NotificationOptions) {
        this.title = title;
        this.body = options?.body;
        this.tag = options?.tag;
        notifications.push({ title, body: options?.body, tag: options?.tag });
      }
      close() {}
    }
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: MockNotification,
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(window, "__tastileNotifications", {
      configurable: true,
      value: notifications,
    });
  });

  await page.goto("/dashboard/tasks");

  const created = await page.evaluate(async (tileTitle) => {
    const createRes = await fetch("/api/proxy/commands/tile/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: tileTitle }),
    });
    const createBody = await createRes.json();
    const tileId = createBody.aggregate.id as string;
    await fetch("/api/proxy/commands/tile/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tile_id: tileId }),
    });
    window.dispatchEvent(new CustomEvent("tastile:execution-changed"));
    return tileId;
  }, title);

  await expect.poll(async () => {
    return page.evaluate(() => {
      return ((window as unknown as { __tastileNotifications: unknown[] }).__tastileNotifications)
        .length;
    });
  }).toBeGreaterThan(0);

  const notification = await page.evaluate((expectedTitle) => {
    return (window as unknown as {
      __tastileNotifications: Array<{ title: string; body?: string; tag?: string }>;
    }).__tastileNotifications.find((item) => item.body?.includes(expectedTitle));
  }, title);
  expect(notification?.title).toBe("Tastile");
  expect(notification?.body).toContain(title);
  expect(notification?.tag === `execution:${created}` || notification?.tag?.startsWith("access:")).toBe(
    true,
  );

  await page.getByRole("button", { name: "Open notifications" }).click();
  await expect(page.getByText(`${title}を実行中です`).first()).toBeVisible();
});
