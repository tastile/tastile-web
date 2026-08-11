import { test, expect } from "@playwright/test";

test.describe("floating schedule editor", () => {
  test("opens a placement-free schedule definition form without exposing implementation inputs", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto("/dashboard/calendar?view=day");

    // The catalog request is read-only.  This test deliberately does not
    // create labels, submit the form, or alter the backing database.
    await page.getByTestId("sidebar-new-tile").first().click();

    const editor = page.getByRole("heading", { name: "タイルを作成" }).locator("xpath=../..");
    await expect(editor).toBeVisible();

    await expect(editor.getByLabel("タイル名")).toBeVisible();
    await expect(editor.getByLabel("必要時間（分）")).toBeVisible();
    const availability = editor.getByLabel("配置できる期間");
    await expect(availability).toBeVisible();
    const save = editor.getByRole("button", { name: "空き時間へ配置する" });
    await expect(save).toBeVisible();
    await expect(save).toBeDisabled();

    // A floating tile asks for required work and a permitted period.  It must
    // not force an actual Placement span or expose AST/identifier controls.
    await expect(editor.locator('input[type="datetime-local"]')).toHaveCount(0);
    await expect(editor.getByText(/UUID|referenceId|LABEL_SPAN|PARENT_SPAN|\bTERM\b|\bALL\b|\bANY\b/)).toHaveCount(0);
    await expect(editor.getByText("実際の開始・終了時刻は、空き時間からあとで決まります。")).toBeVisible();

    const catalogState = availability
      .locator("option")
      .nth(1)
      .or(editor.getByText("使える期間ラベルを先に作成してください。"))
      .or(editor.getByRole("alert"));
    await expect(catalogState).toBeVisible();

    const optionCount = await availability.locator("option").count();
    if (optionCount > 1) {
      await availability.focus();
      await page.keyboard.press("ArrowDown");
      await expect(availability).not.toHaveValue("");
    } else {
      // A fresh E2E database normally has no period label.  The picker must
      // say so (or surface an honest catalog failure), never pretend a label
      // is available.
      await expect(editor.getByText("使える期間ラベルを先に作成してください。").or(editor.getByRole("alert"))).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });
});
