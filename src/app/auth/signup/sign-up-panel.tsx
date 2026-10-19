"use client";

import { authClient } from "@/shared/auth/better-auth/client";
import { useTranslation } from "@/shared/i18n/use-translation";
import { TastileLogo } from "@/shared/ui/TastileLogo";
import { Button, PasswordInput, TextInput } from "@mantine/core";
import Link from "next/link";
import { useState } from "react";

const BRIDGE_PATH = "/api/auth/bridge";
const CONTINUE_PATH = "/dashboard";

function safeNextParam(raw: string | null | undefined): string | null {
	if (!raw) return null;
	if (!raw.startsWith("/") || raw.startsWith("//")) return null;
	return raw;
}

function bridgeCallbackUrl(rawNext: string | null | undefined): string {
	const next = safeNextParam(rawNext);
	if (!next) return BRIDGE_PATH;
	return `${BRIDGE_PATH}?next=${encodeURIComponent(next)}`;
}

export function SignUpPanel() {
	const { t } = useTranslation();
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);

	async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setPending(true);
		const form = new FormData(event.currentTarget);
		const name = String(form.get("name") ?? "");
		const email = String(form.get("email") ?? "");
		const password = String(form.get("password") ?? "");
		const callbackURL = bridgeCallbackUrl(CONTINUE_PATH);
		try {
			const result = await authClient.signUp.email({ name, email, password, callbackURL });
			if (result.error) {
				setError(
					result.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
						? t("auth.signup.errorEmailExists")
						: (result.error.message ?? t("auth.signup.errorFallback")),
				);
				return;
			}
			// BetterAuth creates a session immediately for a new account.
			// Hand control to the bridge route so /api/proxy gets the
			// COOKIE_USER_SUB + COOKIE_API_TOKEN it needs.
			setSubmitted(true);
			window.location.assign(callbackURL);
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="min-h-svh bg-background font-[family-name:var(--font-jp)]">
			<main className="flex min-h-svh w-full flex-col items-center justify-center px-4 py-4">
				<section
					data-testid="signup-panel"
					className="mt-6 w-full max-w-sm rounded-xl bg-surface-elevated p-5 sm:p-6"
				>
					<div className="flex min-h-12 items-center justify-center gap-2 text-foreground">
						<TastileLogo size={36} />
						<span className="text-lg font-semibold leading-none tracking-tight">
							tastile
						</span>
						<h1 className="font-[family-name:var(--font-jp-heading)] text-xl font-semibold leading-none text-foreground">
							{t("auth.signup.heading")}
						</h1>
					</div>

					{submitted ? (
						<div
							role="status"
							className="mt-4 rounded-lg bg-success/10 px-3 py-2 text-sm leading-5 text-success"
						>
							{t("auth.signup.success")}
						</div>
					) : null}

					{error ? (
						<div
							role="alert"
							className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm leading-5 text-danger"
						>
							{error}
						</div>
					) : null}

					{!submitted ? (
						<form onSubmit={handleSignUp} className="my-2 space-y-2">
							<TextInput
								name="name"
								label={t("auth.signup.nameLabel")}
								autoComplete="name"
								required
								styles={{ input: { fontSize: "var(--text-input-size, 16px)" } }}
							/>
							<TextInput
								name="email"
								type="email"
								label={t("auth.signup.emailLabel")}
								autoComplete="email"
								required
								data-testid="signup-email-input"
								styles={{ input: { fontSize: "var(--text-input-size, 16px)" } }}
							/>
							<PasswordInput
								name="password"
								label={t("auth.signup.passwordLabel")}
								autoComplete="new-password"
								minLength={8}
								required
								data-testid="signup-password-input"
								styles={{ input: { fontSize: "var(--text-input-size, 16px)" } }}
							/>
							<Button type="submit" fullWidth loading={pending}>
								{t("auth.signup.heading")}
							</Button>
						</form>
					) : null}

					<Button
						component={Link}
						href={submitted ? "/api/auth/bridge?next=/dashboard" : "/login"}
						fullWidth
						className="my-2"
						variant="subtle"
					>
						{t(submitted ? "auth.signup.continueToApp" : "auth.signup.backToSignin")}
					</Button>
					<section className="mx-4 text-center text-sm leading-5 text-foreground-subtle">
						<p className="text-center text-caption leading-4 text-foreground-subtle">
							{t("auth.signup.legalNotice", {
								termsLink: t("auth.signup.termsLink"),
								privacyLink: t("auth.signup.privacyLink"),
							})}
						</p>
					</section>
				</section>
			</main>
		</div>
	);
}
