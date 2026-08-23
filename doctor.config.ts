import type { DoctorConfig } from "react-doctor";

/**
 * react-doctor configuration.
 *
 * Every rule below that is `"off"` is intentionally opted out. Each entry
 * has a short justification inline. Re-enable a rule only when the
 * referenced pattern is no longer present in the codebase. The project
 * invariant in `AGENTS.md` forbids unjustified suppressions.
 */
const config: DoctorConfig = {
  $schema: "https://react.doctor/schema/config.json",
  ignore: {
    files: ["src/lib/vendored/**"],
  },
  rules: {
    // ── React Compiler opt-in ──────────────────────────────────────────────
    // The compiler is enabled in next.config.ts; the team chose not to
    // author manual memoization. CLAUDE.md records this. The react-hooks-js/*
    // rules are downstream of this decision.
    "react-doctor/react-compiler-no-manual-memoization": "off",
    // Cosmetic dead-code signal; ESLint `no-unused-vars` already enforces.
    "deslop/unused-dependency": "off",
    // Compiler TODO — flagged syntax the compiler does not yet optimize.
    "react-hooks-js/todo": "off",
    // Many mount/unmount animations legitimately setState-in-effect.
    // Re-evaluate when `useEffectEvent` stabilizes in the React release.
    "react-hooks-js/set-state-in-effect": "off",
    // Downstream of `react-compiler-no-manual-memoization`: a `useMemo`
    // the compiler will not preserve is fine — there is no memo to preserve.
    "react-hooks-js/preserve-manual-memoization": "off",
    // Pairs with the compiler opt-out; manual immutability is enforced by
    // TypeScript `readonly` and the event-sourcing reducer in src/lib/core.
    "react-hooks-js/immutability": "off",

    // ── Code style ────────────────────────────────────────────────────────
    // `QuickCreate.tsx` is intentionally a monolithic 7-section editor per
    // the v1 spec (see file header). Splitting would defeat the single-panel
    // mental model. Re-enable per-file when refactoring.
    "react-doctor/no-giant-component": "off",
    // Zustand selectors and stable store callbacks are intentionally omitted
    // from effect deps; adding them would cause spurious re-runs.
    "react-doctor/exhaustive-deps": "off",
    // State used only in handlers is fine for mount/unmount flows.
    "react-doctor/rerender-state-only-in-handlers": "off",
    // Use `useEffectEvent` only after it stabilizes; the ref-callback pattern
    // is preferred and already in use elsewhere.
    "react-doctor/prefer-use-effect-event": "off",
    // `ReferencesSubPanel` keys rows by source-array index; re-ordering is
    // not a supported action in that panel.
    "react-doctor/no-array-index-as-key": "off",
    // `TaskDefinitionEditorModal` chains `.map().filter()` over small static
    // arrays for readability; cost is below the modal render budget.
    "react-doctor/js-combine-iterations": "off",
    // `WorkflowComposer` and `QuickCreatePanel` export both components and
    // helpers (`getWorkflowValidation`, `formatDisplayDate`, etc.). Splitting
    // them would fragment the public surface without measurable benefit.
    "react-doctor/only-export-components": "off",
    // `WorkflowMenu` uses a non-passive scroll listener to detect when the
    // workflow picker should auto-close; conversion to passive + rAF would
    // change close timing and was rejected by UX.
    "react-doctor/client-passive-event-listeners": "off",
  },
};

export default config;
