import { describe, expect, it } from "vitest";
import {
  connectGoogleCalendarAction,
  disconnectGoogleCalendarAction,
  syncNowAction,
  updateLastSyncedAtAction,
} from "./actions";

describe("integrations actions (v1 stub)", () => {
  it("connectGoogleCalendarAction throws because Google Calendar is out of v1 scope", async () => {
    await expect(connectGoogleCalendarAction()).rejects.toThrow(/out of scope/i);
  });

  it("disconnectGoogleCalendarAction throws because Google Calendar is out of v1 scope", async () => {
    await expect(disconnectGoogleCalendarAction()).rejects.toThrow(/out of scope/i);
  });

  it("syncNowAction throws because Google Calendar is out of v1 scope", async () => {
    await expect(syncNowAction()).rejects.toThrow(/out of scope/i);
  });

  it("updateLastSyncedAtAction throws because Google Calendar is out of v1 scope", async () => {
    await expect(updateLastSyncedAtAction()).rejects.toThrow(/out of scope/i);
  });
});
