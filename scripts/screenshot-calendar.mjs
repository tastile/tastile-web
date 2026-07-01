// scripts/screenshot-calendar.mjs
// Usage: node scripts/screenshot-calendar.mjs
// Walks the calendar through all 4 views after seeding sample events.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const OUT = resolve("test-results/screenshots");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Reset store
await page.request.get("http://127.0.0.1:3000/api/events");
await page.request.post("http://127.0.0.1:3000/api/events", {
  data: { title: "Reset wipe" },
}).catch(() => {});

async function deleteAll() {
  const r = await page.request.get("http://127.0.0.1:3000/api/events");
  const data = await r.json();
  for (const e of data.events ?? []) {
    await page.request.delete(`http://127.0.0.1:3000/api/events/${e.id}`);
  }
}
await deleteAll();

// Seed events for today + a few neighbours
const today = new Date();
const todayStr = today.toISOString().slice(0, 10);
function iso(hours) {
  const d = new Date(today);
  d.setUTCHours(hours, 0, 0, 0);
  return d.toISOString();
}
const events = [
  { title: "Team standup", description: "Daily sync", location: "Zoom",
    start: iso(9), end: iso(10), allDay: false, color: "blue", recurrence: { frequency: "none" }, attendees: [] },
  { title: "Design review", description: "New dashboard mockups", location: "Conference room A",
    start: iso(11), end: iso(12), allDay: false, color: "purple", recurrence: { frequency: "none" }, attendees: ["alice@example.com", "bob@example.com"] },
  { title: "Lunch with Megan", description: null, location: "Bistro Bordeaux",
    start: iso(13), end: iso(14), allDay: false, color: "green", recurrence: { frequency: "none" }, attendees: [] },
  { title: "All-hands", description: "Quarterly update", location: "Auditorium",
    start: todayStr + "T00:00:00.000Z", end: todayStr + "T00:00:00.000Z", allDay: true, color: "red", recurrence: { frequency: "none" }, attendees: [] },
  { title: "1:1 with Tom", description: "Career check-in", location: null,
    start: iso(15), end: iso(15.5), allDay: false, color: "orange", recurrence: { frequency: "weekly" }, attendees: [] },
];
for (const e of events) {
  await page.request.post("http://127.0.0.1:3000/api/events", { data: e });
}

await page.goto("http://127.0.0.1:3000/dashboard/calendar");
await page.waitForSelector('[data-testid="calendar-main"]');

async function snap(name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`saved ${name}.png`);
}

await snap("01-day");

await page.getByTestId("cal-view-week").click();
await page.waitForTimeout(800);
await snap("02-week");

await page.getByTestId("cal-view-month").click();
await page.waitForTimeout(800);
await snap("03-month");

await page.getByTestId("cal-view-list").click();
await page.waitForTimeout(800);
await snap("04-list");

// Open the create dialog
await page.getByTestId("cal-view-day").click();
await page.waitForTimeout(400);
await page.getByTestId("cal-create").click();
await page.waitForSelector('[data-testid="event-dialog"]');
await page.waitForTimeout(300);
await snap("05-create-dialog");

// Fill in some text
await page.getByTestId("event-title").fill("Coffee chat");
await page.getByTestId("event-location").fill("Starbucks Shibuya");
await page.getByTestId("event-description").fill("Catch up on Q3 plans");
await page.getByTestId("event-color-teal").click();
await page.waitForTimeout(300);
await snap("06-create-dialog-filled");

await browser.close();
console.log("done");
