/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import * as ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessTokenSection } from "@/shared/ui/AccessTokenSection";
import { SubscriptionSection } from "@/shared/ui/SubscriptionSection";
import { renderWithMantine } from "@/test/render-with-mantine";

vi.mock("@/shared/i18n/use-translation", () => {
  const translate = (key: string) => key;
  return {
    useTranslation: () => ({ t: translate, locale: "en" }),
  };
});

vi.mock("@/lib/stores/locale-store", () => ({
  useLocaleStore: () => ({ locale: "en" }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderSubscriptionSection() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  renderWithMantine(
    <QueryClientProvider client={client}>
      <SubscriptionSection />
    </QueryClientProvider>,
  );
}

function compilerControlFlowViolations(
  fileName: string,
  componentName: string,
  disallowUseEffect = false,
): string[] {
  const source = ts.createSourceFile(
    fileName,
    readFileSync(new URL(fileName, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const component = source.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === componentName,
  );

  if (!component) return [`Missing component: ${componentName}`];

  const violations: string[] = [];
  const visit = (node: ts.Node) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    const isEffectCall =
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useEffect";
    if (ts.isTryStatement(node) && node.finallyBlock) {
      violations.push(`try/finally at line ${line + 1}`);
    }
    if (ts.isThrowStatement(node)) {
      violations.push(`throw at line ${line + 1}`);
    }
    if (disallowUseEffect && isEffectCall) {
      violations.push(`useEffect load at line ${line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(component);
  return violations;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AccessTokenSection", () => {
  it("shows the translated fallback and stops loading when the token request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce("offline"));

    renderWithMantine(<AccessTokenSection />);

    expect(await screen.findByText("account.tokens.error.loadFallback")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("common.loading")).toBeNull();
    });
  });

  it("shows the translated fallback and re-enables submit when token creation rejects", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockRejectedValueOnce("offline");
    vi.stubGlobal("fetch", fetchMock);

    renderWithMantine(<AccessTokenSection />);
    await screen.findByText("account.tokens.empty");

    fireEvent.click(screen.getByRole("button", { name: "account.tokens.issue" }));
    fireEvent.change(
      await screen.findByRole("textbox", { name: "account.tokens.nameLabel" }),
      { target: { value: "CLI token" } },
    );
    const dialog = screen.getByRole("dialog");
    const submit = dialog.querySelector<HTMLButtonElement>("button[type='submit']")!;
    fireEvent.click(submit);

    expect(await screen.findByText("account.tokens.error.createFallback")).toBeTruthy();
    await waitFor(() => {
      expect(submit.disabled).toBe(false);
    });
  });

  it("uses React Compiler-supported control flow", () => {
    expect(
      compilerControlFlowViolations("AccessTokenSection.tsx", "AccessTokenSection"),
    ).toEqual([]);
  });
});

describe("SubscriptionSection", () => {
  it("shows the translated error and leaves the loading view when subscription loading rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")));

    renderSubscriptionSection();

    expect(await screen.findByText("account.subscription.error")).toBeTruthy();
    expect(screen.getByText("account.subscription.currentPlan")).toBeTruthy();
  });

  it("shows the translated error and re-enables manage when opening the portal rejects", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          subscription: {
            status: "active",
            interval: "monthly",
            priceId: "price_monthly",
            customerId: "cus_1",
            currentPeriodEnd: 0,
            cancelAtPeriodEnd: false,
          },
        }),
      )
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    renderSubscriptionSection();
    const manage = await screen.findByRole("button", { name: "account.subscription.manage" });
    fireEvent.click(manage);

    expect(await screen.findByText("account.subscription.error")).toBeTruthy();
    await waitFor(() => {
      expect(
        (screen.getByRole("button", {
          name: "account.subscription.manage",
        }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });
  });

  it("uses React Compiler-supported control flow", () => {
    expect(
      compilerControlFlowViolations(
        "SubscriptionSection.tsx",
        "SubscriptionSection",
        true,
      ),
    ).toEqual([]);
  });
});
