# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | ✅ Active          |
| <latest | ❌ End-of-life     |

Only the latest minor release receives security backports. Older versions
are not maintained. Please upgrade.

## Reporting a Vulnerability

**Please do not file public GitHub issues for security vulnerabilities.**

Use one of these channels:

1. **GitHub Security Advisories** (preferred; private thread with the
   maintainers): https://github.com/tastile/tastile-web/security/advisories/new
2. **X (Twitter) DM** to `@361do_sleep` for urgent pre-disclosure matters.

We acknowledge within 2 business days and aim to ship a fix within 30 days
for high-impact issues.

## Security Scope

* This client is a thin shell over the `tastile-core` REST API. Auth,
  authorization, and multi-tenant isolation live in `tastile-core` (private);
  report API-layer vulnerabilities there instead.
* The hosted demo at `*.demo.tastile.app` runs in an isolated AWS account
  with rate limits and a kill-switch. It is not suitable for storing
  sensitive personal data — do not paste production secrets into your demo
  account.
