import { expect, test } from "@playwright/test";

/**
 * /login smoke spec — covers the unauthenticated login shell and the redirect
 * error surface (e.g. ?error=no_session) without making any auth API call.
 *
 * The panel uses semantic HTML: <h1> for the heading, <input type="email">
 * and Mantine's PasswordInput (still rendered as <input type="password">) for
 * the email/password fields, and an inline "Create account" anchor pointing
 * at /auth/signup. Element types and headings are derived from the
 * translation keys auth.login.{heading,emailLabel,passwordLabel,submit,
 * createAccount} in src/shared/i18n/sections/system/auth.ts. This spec stays
 * locale-resilient by matching all five shipping locales (en, ja, zh-CN,
 * ko, es) rather than hard-coding English copy.
 */

const HEADING = /sign in|サインイン|登录|로그인|iniciar sesi[oó]n/i;
const EMAIL_LABEL = /email|メールアドレス|邮箱|이메일|correo electr[oó]nico/i;
const SUBMIT_BUTTON = /sign in|サインイン|登录|로그인|メール|이메일|sesi[oó]n/i;
const CREATE_ACCOUNT = /create account|アカウントを作成|创建账户|계정 만들기|crear cuenta/i;
const ERROR_TEXT = /sign.?in is required|required\.|サインインが必要|请先登录|로그인이 필요|Se requiere iniciar sesi[oó]n|failed|expired|セッション|세션|sesi[oó]n/i;

test.describe("/login smoke", () => {
	test("renders login form with email, password, and submit", async ({ page }) => {
		await page.goto("/login");

		// h1 with login heading (locale-resilient).
		await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
		await expect(page.getByRole("heading", { level: 1, name: HEADING }).first()).toBeVisible();

		// Email input — matched by accessible name (the Mantine TextInput label).
		await expect(page.getByRole("textbox", { name: EMAIL_LABEL }).first()).toBeVisible();

		// Password input — matched by rendered type attribute (Mantine
		// PasswordInput still produces <input type="password"> under the hood).
		await expect(page.locator("input[type='password']").first()).toBeVisible();

		// Submit button — match by accessible name, i18n-aware.
		await expect(page.getByRole("button", { name: SUBMIT_BUTTON }).first()).toBeEnabled();

		// Link to /auth/signup (the actual route used by the panel — not /signup).
		await expect(page.getByRole("link", { name: CREATE_ACCOUNT }).first()).toBeVisible();
		await expect(
			page.getByRole("link", { name: CREATE_ACCOUNT }).first(),
		).toHaveAttribute("href", /\/auth\/signup$/);
	});

	test("?error=no_session surfaces the redirect error message", async ({ page }) => {
		await page.goto("/login?error=no_session");

		// The panel renders any initial-error text inside a role="alert"
		// region inside the login shell (scoped via the panel testid to
		// avoid matching Next.js's hidden __next-route-announcer__ which
		// also has role="alert"). The fallback text matcher covers the
		// resolved error string for en / ja / zh-CN / ko / es locales
		// (see src/shared/i18n/sections/system/auth.ts).
		const panel = page.getByTestId("login-panel");
		const errorRegion = panel
			.getByRole("alert")
			.or(panel.getByText(ERROR_TEXT));
		await expect(errorRegion.first()).toBeVisible();
	});
});