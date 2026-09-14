import { getPlans, getStripe } from "@/lib/stripe";
import { resolveAuthenticatedUserSub } from "@/shared/auth/authenticated-session";
import { NextResponse } from "next/server";

// W06 (2026-09-19 free launch): new paid checkouts are disabled.
// Existing paid users keep their subscription and can still cancel via
// POST /api/stripe/portal — only the upgrade / new-subscription path
// is removed.
export async function POST(_request: Request) {
	const _userSub = await resolveAuthenticatedUserSub();
	void _userSub;
	void getPlans;
	void getStripe;
	return NextResponse.json(
		{
			error: "checkout_disabled",
			message:
				"Paid plans are not available on or after the 2026-09-19 release.",
		},
		{ status: 410 },
	);
}
