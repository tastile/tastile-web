---
name: useeffect-strict
description: Use when writing, reviewing, or refactoring React components in tastile-web. Apply the "useEffect as UI lifecycle, not side-effect plumbing" rule from uhyo's "過激派が教える！ useEffectの正しい使い方" — guards against value-change reactions, missing cleanup, ref-as-StrictMode-shield, and dependency-array-as-logic. Trigger on any new useEffect, any PR touching `useEffect(`, or when an agent proposes fixing a double-mount/race with `useRef(false)` instead of restructuring.
---

# useEffect Strict (uhyo-aligned)

`useEffect` is a UI lifecycle tool, not a generic side-effect escape hatch.
The rules below are derived from uhyo's "過激派が教える！ useEffectの正しい使い方"
(2026-08 snapshot). When a reviewer asks "why is this effect here?", the answer
must be one of:

- I am registering/unregistering a listener on something React doesn't own
  (`window`, `document`, a third-party widget, a polling timer).
- I am performing a one-shot imperative UI bootstrap that is unsafe to express
  declaratively (`Element.focus()` after hydration, manual `IntersectionObserver`).

Anything else is a smell.

## When this Skill fires

- New or edited `useEffect(` in `src/**/*.{ts,tsx}`.
- New or edited `useLayoutEffect(` in the same scope.
- A reviewer asks why an effect exists and the author cannot answer.
- A bug report mentions double-firing under StrictMode, "useEffect ran twice",
  "Maximum update depth exceeded", "stale closure", or "the effect didn't
  fire when the user clicked".
- A fix proposal introduces `useRef(false)` to swallow the second effect run.

## Two foundational rules

1. **React is a UI library.** All UI management is React's job. Everything that
   is *not* UI management — analytics, command dispatch, business state — lives
   outside React (TanStack Query mutation callbacks, Zustand stores, the
   `tastile-core` Command API). If a `useEffect` calls a function that does not
   touch the DOM, it is the wrong hook.
2. **React is component-based.** Every effect runs in the context of one
   component; every effect that opens a resource must close it. An effect
   without a cleanup function (or with a "fire-and-forget" body) is
   unconditionally bad — it breaks the component contract on unmount.

## Anti-patterns (do not write, do not approve)

| Anti-pattern | Why it is wrong | Fix |
| --- | --- | --- |
| `useEffect(() => { track("search", { q }); }, [q])` | Reacting to a value change is not UI work. The event already happened — call the tracker at the source event. | Move the call into the `onChange` / `onSubmit` handler that owns the value. |
| `useEffect(() => { setStoredPath(path); }, [path])` for "last visited path" | This is value-change plumbing. The hook is encoding routing state into a side store, which the router already owns. | Read the path at the event boundary (`router.replace` callback, `Link onClick`) or drop the store. |
| `useEffect(() => { gtag("config", id, { page_path: pathname }); }, [pathname])` | Pageview tracking via pathname is forbidden — the comment thread on the source article even notes that official Next.js docs fall into this trap. | Subscribe to router events (`router.events` / Next 15+ equivalent) in a layout effect with explicit `subscribe`/`unsubscribe`. |
| `useEffect(() => { fetch(url).then(setUser); }, [url])` without `AbortController` | Fetch without cancellation leaks requests on unmount and produces "Can't perform a state update on an unmounted component" warnings. | Either `AbortController` + cleanup, or move to TanStack Query (`useQuery`) which owns the lifecycle. |
| `const ranOnce = useRef(false); useEffect(() => { if (ranOnce.current) return; ... }, [...])` | The ref guards the symptom; the disease is using `useEffect` for work that doesn't belong there. | Restructure so the effect runs exactly once on mount (empty deps + cleanup) or move the work elsewhere. |
| `useEffect(() => { doThing(x); }, [...deps that include x])` where `x` is state you also `setX` in the effect body | Loop of state ↔ effect. The state belongs outside React (Zustand) or the call belongs in the setter. | Use `useSyncExternalStore` for external sources, or co-locate the derived value in the same state object. |
| `useEffect(() => { return () => clearInterval(id); }, [paused])` — timer gated by `paused` boolean with a separate effect | Two effects (`start` + `stop`) dance around the boolean. The state shape is the problem. | Co-locate `count` and `paused` in one state object, run the interval once, filter `paused` inside the updater. See uhyo's "Simplest — 💯" timer. |
| `useEffect(() => { /* no return */ })` | No cleanup means the component violates its contract on unmount. Always wrong. | Add a cleanup that undoes what the body set up, or delete the effect. |
| Encoding logic in the dependency array (`useEffect(..., [a, b, c])` where the *combination* matters, not the individual values) | The dep array is an optimization hint, not a semantic expression. | Compute a stable key upstream and depend on it, or move the logic outside the effect. |

## Allowed patterns

### Listener registration (😃)

```tsx
useEffect(() => {
  const handler = () => setH((h) => (h + 1) % 360);
  window.addEventListener("pointermove", handler);
  return () => window.removeEventListener("pointermove", handler);
}, []);
```

### Data fetch with abort (🙃)

```tsx
useEffect(() => {
  const ac = new AbortController();
  fetch(url, { signal: ac.signal })
    .then((r) => r.json())
    .then(setUser);
  return () => ac.abort();
}, [url]);
```

Prefer TanStack Query when the data is reusable across components.

### One-shot imperative bootstrap (😃)

```tsx
useLayoutEffect(() => {
  ref.current?.focus();
}, []);
```

### Polling timer that is owned by the component (🙃)

```tsx
useEffect(() => {
  const id = window.setInterval(refresh, 15_000);
  return () => window.clearInterval(id);
}, [refresh]);
```

OK because `refresh` is stable and the lifecycle (start on mount, stop on
unmount) matches React's model. Do not add a second `paused` effect to gate it.

### Co-located state for compound timers (💯)

```tsx
useEffect(() => {
  const id = setInterval(() => {
    setState((prev) => (prev.paused ? prev : { ...prev, count: prev.count + 1 }));
  }, 1_000);
  return () => clearInterval(id);
}, []);
```

Pause/resume is a property of state, not a property of effects.

## Red flags — STOP and refactor

- `useEffect` body that does not touch the DOM.
- `useEffect` body that calls `track(` / `analytics(` / `log(` / `report(`.
- `useEffect` deps that include a value also produced by a setter in the same
  effect.
- `useRef(false)` (or any "ran once" guard) immediately above a `useEffect`.
- Two `useEffect` blocks for the same timer / listener (one to start, one to
  stop).
- An effect that reads `localStorage` / `sessionStorage` and writes back the
  same value (round-trip no-op).
- `useEffect` whose only dependency is a setter returned from a hook but the
  setter is destructured to ignore it (the effect is dead code).

## Quick triage (run before approving any effect)

```text
1. Does the body touch the DOM or a non-React external (window/document/widget)?
   yes → legit, ensure cleanup
   no  → wrong hook, move out

2. Does the body register something that needs symmetric unregistration?
   yes → ensure the cleanup return is present and correct
   no  → the effect is probably a value-reaction, refactor

3. Do the deps include a value also assigned inside the body?
   yes → loop, refactor
   no  → OK, but double-check whether deps are actually needed

4. Is there a `useRef(false)` guard immediately above the effect?
   yes → the effect is wrong, not just guarded
   no  → continue

5. Would moving this work to a Query mutation / event handler / Zustand
   action make the code simpler?
   yes → do it
   no  → the effect stays, with cleanup
```

## Known violations in this repo (snapshot 2026-08-24)

These are the live instances found in `src/**/*.{ts,tsx}` and should be
addressed by sub-agent in the next pass. New violations must be added here
when discovered.

| File | Lines | Pattern | Disposition |
| --- | --- | --- | --- |
| `src/shared/ui/GoogleAnalytics.tsx` | 21–29 | `gtag("config", …, { page_path: pathname })` in effect on `[pathname]` — value-change pageview tracking | Replace with router-event subscription |
| `src/shared/hooks/use-track-visit.ts` | 27–29 | `setStoredPath(path)` in effect on `[path]` — value-change localStorage write | Move to `Link onClick` or remove |
| `src/widgets/app-shell/ui/AppShell.tsx` | 59–61 | Effect writes `RAIL_PINNED_KEY` on `[railPinned]`, but `railPinned` has no setter — dead-code round-trip | Delete the effect; the lazy initializer already reads the value |
| `src/shared/context/auth-context.tsx` | 38–42 | `window.location.href = "/login?error=session_expired"` in effect on error | Move to `useEffectEvent` or the queries' `meta.onError`; redirect is a navigation side effect, not a render-bound effect |
| `src/widgets/floating-header/ui/FloatingHeader.tsx` | 73–76 | Two-step `useInterval` start/stop effect driven by `ticking` boolean | Co-locate into a single state object or accept as a legitimate lifecycle effect with a comment justifying the shape |

The `useInterval`/`setInterval` cases in
`src/widgets/app-shell/ui/ActiveExecutionBar.tsx`,
`src/widgets/floating-header/ui/ExecutionControls.tsx`, and
`src/shared/hooks/use-notifications.ts` are legitimate — they own a real
lifecycle with cleanup. Do not refactor those.

## Verification before claiming a fix

1. `bun run check` — 0 errors, 0 actionable warnings.
2. `bun run doctor` — score does not regress.
3. The changed effect either:
   - registers/unregisters a non-React resource with explicit cleanup, **or**
   - performs a one-shot imperative bootstrap with `useLayoutEffect` and
     empty deps, **or**
   - has been deleted (the work moved to an event handler / Query mutation).
4. The diff has no new `useRef(false)` adjacent to a `useEffect`.

## Cross-references

- `.agents/skills/quality-gate/SKILL.md` — final lint/typecheck/test gate.
- `.agents/skills/react-doctor/SKILL.md` — broader React health scan (this
  Skill is the focused subset that uhyo's article calls out).
- `.agents/skills/architecture/SKILL.md` — Command/Event/Reducer routing;
  effects that dispatch commands belong in the reducer, not the effect.
- Source article:
  <https://zenn.dev/uhyo/articles/useeffect-taught-by-extremist>
