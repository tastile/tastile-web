"use client";

import { authClient } from "@/shared/auth/better-auth/client";
import { useTranslation } from "@/shared/i18n/use-translation";
import { TastileLogo } from "@/shared/ui/TastileLogo";
import { Button, PasswordInput, TextInput } from "@mantine/core";
import { Apple, Fingerprint, Globe } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const BRIDGE_PATH = "/api/auth/bridge";

type ErrorKey =
	| "no_session"
	| "session_expired"
	| "invalid_email_or_password"
	| "email_not_verified";

/**
 * Map URL-contract error keys (snake_case) to translation-tree suffixes
 * (camelCase). The translation tree uses camelCase per the canonical
 * convention in `src/shared/i18n/sections/system/auth.ts` and confirmed
 * by `src/app/marketing-layout.test.tsx:48-55`. The URL contract stays
 * snake_case so external clients hitting `?error=no_session` keep working.
 */
const ERROR_KEY_TO_TRANSLATION: Record<ErrorKey, string> = {
	no_session: "noSession",
	session_expired: "sessionExpired",
	invalid_email_or_password: "invalidEmailOrPassword",
	email_not_verified: "emailNotVerified",
};

function errorKey(code: string | undefined | null): ErrorKey | null {
	if (
		code === "no_session" ||
		code === "session_expired" ||
		code === "invalid_email_or_password" ||
		code === "email_not_verified"
	) {
		return code;
	}
	return null;
}

export function LoginPanel(props: {
	googleEnabled: boolean;
	appleEnabled: boolean;
	/** Redirect-level error key (e.g. ?error=no_session from the middleware). */
	initialError?: string | null;
}) {
	const { t } = useTranslation();
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(() => {
		const key = errorKey(props.initialError);
		if (key) return t(`auth.login.errors.${ERROR_KEY_TO_TRANSLATION[key]}`);
		if (props.initialError)
			return t("auth.login.errors.generic", { code: props.initialError });
		return null;
	});

	async function handleEmailSignIn(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setPending(true);
		const form = new FormData(event.currentTarget);
		const email = String(form.get("email") ?? "");
		const password = String(form.get("password") ?? "");
		try {
			const result = await authClient.signIn.email({
				email,
				password,
				callbackURL: BRIDGE_PATH,
			});
			if (result.error) {
				const key = errorKey(result.error.code);
				setError(
					key
						? t(`auth.login.errors.${ERROR_KEY_TO_TRANSLATION[key]}`)
						: t("auth.login.errors.fallback"),
				);
				return;
			}
			// Full navigation so the new session cookie is visible to the bridge
			// route's server-side verification.
			window.location.assign(BRIDGE_PATH);
		} finally {
			setPending(false);
		}
	}

	function handleSocial(provider: "google" | "apple") {
		setError(null);
		void authClient.signIn.social({ provider, callbackURL: BRIDGE_PATH });
	}

	return (
		<div className="min-h-svh bg-background font-[family-name:var(--font-jp)]">
			<main className="flex min-h-svh w-full flex-col items-center justify-center px-4 py-4">
				<section
					data-testid="login-panel"
					className="mt-6 w-full max-w-sm rounded-xl bg-surface-elevated p-5 sm:p-6"
				>
					<div className="flex min-h-12 items-center justify-center gap-2 text-foreground">
						<TastileLogo size={36} />
						<span className="text-lg font-semibold leading-none tracking-tight">
							tastile
						</span>
						<h1 className="font-[family-name:var(--font-jp-heading)] text-xl font-semibold leading-none text-foreground">
							{t("auth.login.heading")}
						</h1>
					</div>

					{error ? (
						<div
							role="alert"
							className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm leading-5 text-danger"
						>
							{error}
						</div>
					) : null}

					<div className="my-2 space-y-2">
						{props.googleEnabled ? (
							<Button
								variant="outline"
								onClick={() => handleSocial("google")}
								leftSection={<Globe className="size-4" aria-hidden="true" />}
								fullWidth
							>
								{t("auth.login.google")}
							</Button>
						) : null}
						{props.appleEnabled ? (
							<Button
								variant="outline"
								onClick={() => handleSocial("apple")}
								leftSection={<Apple className="size-4" aria-hidden="true" />}
								fullWidth
							>
								{t("auth.login.apple")}
							</Button>
						) : null}
					</div>
					<hr className="mx-1 opacity-20" />

					<form onSubmit={handleEmailSignIn} className="my-2 space-y-2">
						<TextInput
							name="email"
							type="email"
							label={t("auth.login.emailLabel")}
							autoComplete="email"
							required
							data-testid="login-email-input"
						/>
						<PasswordInput
							name="password"
							label={t("auth.login.passwordLabel")}
							autoComplete="current-password"
							required
							data-testid="login-password-input"
						/>
						<Button
							type="submit"
							fullWidth
							loading={pending}
							leftSection={
								<Fingerprint className="size-4" aria-hidden="true" />
							}
						>
							{t("auth.login.submit")}
						</Button>
					</form>

					<hr className="mx-1 opacity-20" />
					<Button
						component={Link}
						href="/auth/signup"
						fullWidth
						className="my-2"
						variant="subtle"
					>
						{t("auth.login.createAccount")}
					</Button>
					<section className="mx-4 text-center text-sm leading-5 text-foreground-subtle">
						<p className="text-center text-caption leading-4 text-foreground-subtle">
							{t("auth.login.legalNotice", {
								termsLink: t("auth.login.termsLink"),
								privacyLink: t("auth.login.privacyLink"),
							})}
						</p>
					</section>
				</section>
			</main>
		</div>
	);
}
