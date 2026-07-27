import { describe, expect, it } from "vitest";
import { callbackHtmlResponse } from "./callback-html";

async function readBody(response: Response): Promise<string> {
  return await response.text();
}

function extractScriptJson(html: string): string {
  const match = html.match(
    /<script type="application\/json" id="auth-callback-destination">([\s\S]*?)<\/script>/,
  );
  if (!match) {
    throw new Error("script block not found");
  }
  return match[1] ?? "";
}

function unescapeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
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
    expect(scriptCloseCount).toBe(2);

    const scriptJson = extractScriptJson(html);
    expect(JSON.parse(unescapeHtml(scriptJson))).toBe(destination);
  });

  it("escapes <, >, and & in the JSON script tag", async () => {
    const destination = "/d?x=<a>&y=2";
    const response = callbackHtmlResponse({
      title: "t",
      message: "m",
      destination,
      tone: "success",
    });
    const html = await readBody(response);
    const scriptJson = extractScriptJson(html);

    expect(scriptJson).toContain("&lt;");
    expect(scriptJson).toContain("&gt;");
    expect(scriptJson).toContain("&amp;");

    expect(JSON.parse(unescapeHtml(scriptJson))).toBe(destination);
  });

  it("preserves a normal destination path", async () => {
    const destination = "/dashboard/calendar?date=2026-07-23";
    const response = callbackHtmlResponse({
      title: "Welcome",
      message: "Loading…",
      destination,
      tone: "success",
    });
    const html = await readBody(response);

    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");

    const scriptJson = extractScriptJson(html);
    expect(JSON.parse(unescapeHtml(scriptJson))).toBe(destination);

    expect(html).toContain("Welcome");
    expect(html).not.toContain("<script>alert");
  });
});
