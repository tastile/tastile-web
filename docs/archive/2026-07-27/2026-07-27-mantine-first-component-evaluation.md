# Mantine Component Migration Evaluation (Task 11)

> Documents the outcome of Task 11 in the Mantine-first state optimization
> plan. Conclusion up front: **both `FloatingMenu` and `Dropdown` are
> retained**. Rationale per component below.

## FloatingMenu vs Mantine Menu / Popover

**Decision: keep `FloatingMenu`.** No migration proposed.

The custom component has one production consumer in the dashboard today
(`src/components/notifications/NotificationsMenu.tsx`) plus the avatar
menu in `src/components/shell/FloatingHeader.tsx`. Both rely on a
behavior Mantine's `Menu` / `Popover` do not provide cleanly:

- **`triggerRef` for an external anchor.** The notifications bell lives
  in the floating header; its dropdown panel lives in the dashboard
  layout, with the trigger DOM element and the portal content in
  different parents. Mantine `Menu`'s `MenuTarget` colocates trigger
  and dropdown, and `Popover`'s anchor ref pattern is a near-fit but
  doesn't expose `data-floating-menu-*` hook attributes or the
  `aria-controls` linkage the existing CSS and tests depend on.
- **Programmatic positioning** (`align`, `side`, `sideOffset`,
  viewport-flipping) implemented in
  `src/components/ui/floating-menu/FloatingMenu.tsx`. Mantine
  `Popover` has its own positioning engine (`middlewares` /
  `FloatingArrow`) with a different mental model and would require
  re-deriving the four positioning tests in
  `__tests__/FloatingMenu.test.tsx`.
- **Custom compound API** (`Trigger`/`Content`/`Item`/`Label`/
  `Separator`) with `asChild` support. Replacing with Mantine `Menu`
  would force consumers to rewrite JSX and lose the
  `data-floating-menu-trigger` / `data-floating-menu-content` hooks
  the dashboard layout uses to position side panels.

The `useUncontrolled` refactor from Task 7 already removed the
hand-rolled controlled/uncontrolled plumbing. Remaining state is
positioning, focus management (ArrowUp/ArrowDown/Home/End), and
outside-click / Escape handling — all behavior Mantine primitives
would force us to re-implement.

## Dropdown vs Mantine Select / Combobox

**Decision: keep `Dropdown`, optionally trim unused props.** No migration
proposed.

The three consumers (`TasksSidePanel`, `TimelineAxis`,
`dashboard/events/page.tsx`) only pass `value`, `onChange`, `size`,
`items`, and `className`. The remaining props (`renderItem`,
`renderTrigger`, `searchable`, `group`, `icon`, `defaultValue`,
`onOpenChange`, `disabled`, `triggerClassName`, `contentClassName`,
`invalid`) are dead.

`Dropdown` is already a 90-line wrapper around Mantine `Select`. The
component itself is "Mantine-first" — it just hides the prop names
that fit dashboard vocabulary (`tiny`/`small`/`medium`/`large` instead
of Mantine's `xs`/`sm`/`md`/`lg`). Replacing it with raw `Select`
would either (a) require updating three call sites or (b) leaving a
wrapper anyway. Neither is a clear win.

`useUncontrolled` could replace the manual `isControlled` branch on
lines 68-73, but the component is 90 lines and already minimal — not
worth a behavior-touching edit unless the prop shape is also trimmed.

## Follow-up actions

None. This evaluation closes Task 11 of the Mantine-first plan.