import { describe, expect, it } from "vitest";
import { callbackHtmlResponse } from "./callback-html";

async function readBody(response: Response): Promise<string> {
  return await response.text();
}

function extractScriptJson(html: string): string {
  const match = html.match(
    /window\.location\.replace\(([\s\S]*?)\);\s*},\s*900\);<\/script>/,
  );
  if (!match) {
    throw new Error("script block not found");
  }
  return match[1] ?? "";
}

describe("callbackHtmlResponse", () => {
  it("does not let a malicious destination break out of the inline script", async () => {
    const destination =
      "/dashboard?x=</script><script>alert('pwn')</script>&a=1&b=2&c=3";
    const response = callbackHtmlResponse({
      title: "t",
      message: "m",
      destination,
      tone: "success",
    });
    const html = await readBody(response);

    expect(html).not.toContain("</script><script>alert('pwn')</script>");

    const scriptCloseCount = (html.match(/<\/script>/gi) ?? []).length;
    expect(scriptCloseCount).toBe(1);

    const scriptJson = extractScriptJson(html);
    expect(JSON.parse(scriptJson)).toBe(destination);
  });

  it("escapes <, >, &, U+2028, and U+2029 in the inline script JSON literal", async () => {
    const destination = "/d?x=<a>&y=2 z=3 w=4";
    const response = callbackHtmlResponse({
      title: "t",
      message: "m",
      destination,
      tone: "success",
    });
    const html = await readBody(response);
    const scriptJson = extractScriptJson(html);

    expect(scriptJson).toContain("\\u003c");
    expect(scriptJson).toContain("\\u003e");
    expect(scriptJson).toContain("\\u0026");
    expect(scriptJson).toContain("\\u2028");
    expect(scriptJson).toContain("\\u2029");

    expect(JSON.parse(scriptJson)).toBe(destination);
  });

  it("preserves a normal destination path", async () => {
    const destination = "/dashboard/calendar?date=2026-07-23";
    const response = callbackHtmlResponse({
      title: "ようこそ",
      message: "読み込み中…",
      destination,
      tone: "success",
    });
    const html = await readBody(response);

    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");

    const scriptJson = extractScriptJson(html);
    expect(JSON.parse(scriptJson)).toBe(destination);

    expect(html).toContain("ようこそ");
    expect(html).not.toContain("<script>alert");
  });
});
