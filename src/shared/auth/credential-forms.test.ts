import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A form submitted before hydration falls back to the browser default (GET),
// which would put the email and password into the URL, browser history and
// server request logs. Every credential form must declare method="post".
const CREDENTIAL_FORM_FILES = [
  "src/app/login/login-panel.tsx",
  "src/app/auth/signup/sign-up-panel.tsx",
  "src/views/dashboard/AccountSettingsPage.tsx",
];

describe("credential forms", () => {
  for (const file of CREDENTIAL_FORM_FILES) {
    it(`${file} never falls back to a GET submit`, () => {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const forms = source.match(/<form\b[^>]*>/g) ?? [];
      expect(forms.length).toBeGreaterThan(0);
      for (const form of forms) expect(form).toMatch(/method="post"/);
    });
  }
});
