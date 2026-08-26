"use client";

import { ChevronRight } from "lucide-react";
import {
  Children,
  type ReactElement,
  type ReactNode,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  WORKFLOW_CONFIG,
  WORKFLOW_ORDER,
  type WorkflowKind,
} from "@/features/create-tile/model/workflow-config";
import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";

export interface WorkflowMenuProps {
  /**
   * The element that opens the menu when clicked. If the element is a
   * React component that accepts `onClick` (e.g. a button), the menu's
   * toggle handler is injected directly so we don't nest <button> inside
   * <button>. Plain nodes are wrapped in a span.
   */
  trigger: ReactNode;
  /** Optional callback fired with the chosen workflow after selection. */
  onSelect?: (kind: WorkflowKind) => void;
  /** Alignment of the dropdown relative to the trigger. */
  align?: "start" | "end";
  /** Vertical side relative to the trigger. */
  side?: "bottom" | "top";
  /** Test id forwarded to the dropdown container. */
  testId?: string;
}

const ALIGN_CLASS: Record<NonNullable<WorkflowMenuProps["align"]>, string> = {
  start: "left-0",
  end: "right-0",
};
const SIDE_CLASS: Record<NonNullable<WorkflowMenuProps["side"]>, string> = {
  bottom: "top-full mt-1",
  top: "bottom-full mb-1",
};

/**
 * Workflow picker — opens a small dropdown anchored to a trigger element
 * with three large buttons (Event / Task / Recurring). Each button shows
 * the workflow icon, label, and a 1-line description. Selecting a
 * workflow closes the dropdown and writes the chosen kind into the
 * QuickCreate store via `setWorkflow`. The store update is what actually
 * swaps the rendered form inside the panel — the menu itself only owns
 * the picker UI.
 *
 * Implementation note: this uses a controlled div rather than Mantine
 * Popover so the dropdown renders inline with the trigger (predictable
 * z-index inside the panel) and so the trigger can be any element
 * without a Popover wrapper.
 */
export function WorkflowMenu({
  trigger,
  onSelect,
  align = "start",
  side = "bottom",
  testId = "workflow-menu",
}: WorkflowMenuProps) {
  const { t } = useTranslation();
  const setWorkflow = useQuickCreateStore((s) => s.setWorkflow);
  const setLegacyEditor = useQuickCreateStore((s) => s.setLegacyEditor);
  const [opened, setOpened] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!opened) return;
    function handlePointer(e: MouseEvent | TouchEvent) {
      const node = rootRef.current;
      if (!node) return;
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (!node.contains(target)) setOpened(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpened(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [opened]);

  const handleSelect = useCallback(
    (kind: WorkflowKind) => {
      // The four workflow kinds are peers: the first three open the
      // specialized form for that kind; "detailed" is a peer that
      // opens the original 7-section monolithic editor — not a
      // legacy fallback, just the original full-fidelity editor.
      // Per user feedback (2026-08-13): all four are peer editors,
      // no hierarchy. The internal flag stays `useLegacyEditor`
      // for backwards-compat with the gating logic in the layout
      // shell, but conceptually it's "use the detailed editor".
      if (kind === "detailed") {
        setLegacyEditor(true);
      } else {
        setWorkflow(kind);
        setLegacyEditor(false);
      }
      onSelect?.(kind);
      setOpened(false);
    },
    [setWorkflow, setLegacyEditor, onSelect],
  );

  const toggle = useCallback(() => {
    setOpened((v) => !v);
  }, []);

  const renderTrigger = () => {
    const child = Children.only(trigger);
    if (isValidElement(child)) {
      const el = child as ReactElement<{
        onClick?: (e: React.MouseEvent) => void;
      }>;
      // Inject click + aria props so we don't wrap a button in a button.
      // biome-ignore lint/suspicious/noExplicitAny: cloneElement overload is too narrow for cross-element prop injection.
      const injected: Record<string, any> = {
        onClick: (e: React.MouseEvent) => {
          el.props.onClick?.(e);
          toggle();
        },
        "aria-haspopup": "menu",
        "aria-expanded": opened,
        "data-testid": "workflow-menu-trigger",
      };
      return cloneElement(el, injected);
    }
    return (
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={opened}
        data-testid="workflow-menu-trigger"
        className="contents"
      >
        {child}
      </button>
    );
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      {renderTrigger()}
      {opened ? (
        <div
          role="menu"
          data-testid={testId}
          className={`absolute z-50 min-w-[16rem] rounded-md bg-surface-1 p-2 ${ALIGN_CLASS[align]} ${SIDE_CLASS[side]}`}
        >
          <div className="mb-2 px-2">
            <div className="text-xs font-semibold text-foreground-muted">
              {t("quickCreate.menuPickerTitle")}
            </div>
            <div className="text-caption text-foreground-muted">
              {t("quickCreate.menuPickerSubtitle")}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {WORKFLOW_ORDER.map((kind) => {
              const config = WORKFLOW_CONFIG[kind];
              const Icon = config.icon;
              return (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(kind)}
                  data-testid={`workflow-menu-item-${kind}`}
                  className="group flex items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">
                      {t(`quickCreate.${config.menuLabelKey}`)}
                    </span>
                    <span className="block text-caption text-foreground-muted">
                      {t(`quickCreate.${config.menuDescriptionKey}`)}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="mt-2 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70 group-focus:opacity-70"
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
