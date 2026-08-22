import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

// Transactional auth email delivery (ADR 2026-08-22: Cognito → BetterAuth).
// SES is retained from the Cognito era; BetterAuth hooks hand us the message
// and this module delivers it. When TASTILE_SES_FROM_ADDRESS is absent
// (local dev / unit tests) the delivery is skipped; if the caller supplies
// `devUrl` the actionable link is printed instead so the flow stays usable
// without SES credentials.

export async function sendAuthEmail(args: {
  to: string;
  subject: string;
  html: string;
  /** Verification/reset link surfaced in logs when SES is not configured. */
  devUrl?: string;
}): Promise<void> {
  const fromAddress = process.env.TASTILE_SES_FROM_ADDRESS?.trim();
  if (!fromAddress) {
    console.warn(
      `[auth-email] TASTILE_SES_FROM_ADDRESS unset; skipped "${args.subject}" to ${args.to}`,
    );
    if (args.devUrl) {
      console.info(`[auth-email] DEV LINK (${args.to}): ${args.devUrl}`);
    }
    return;
  }
  const region = process.env.TASTILE_SES_REGION?.trim() || "ap-northeast-1";
  const configurationSetName = process.env.TASTILE_SES_CONFIGURATION_SET?.trim();

  const client = new SESv2Client({ region });
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: fromAddress,
      Destination: { ToAddresses: [args.to] },
      ...(configurationSetName ? { ConfigurationSetName: configurationSetName } : {}),
      Content: {
        Simple: {
          Subject: { Data: args.subject, Charset: "UTF-8" },
          Body: { Html: { Data: args.html, Charset: "UTF-8" } },
        },
      },
    }),
  );
}

export function verificationEmailHtml(url: string): string {
  return `<p>Welcome to Tastile.</p><p>Confirm your email address:</p><p><a href="${url}">${url}</a></p><p>This link expires when a newer one is requested.</p>`;
}

export function passwordResetEmailHtml(url: string): string {
  return `<p>A password reset was requested for your Tastile account.</p><p><a href="${url}">${url}</a></p><p>If this wasn't you, ignore this message.</p>`;
}
