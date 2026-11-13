import { useLayoutEffect, useRef } from "react";
// Priority, rather than React parent/child effect order, determines the visible
// overlay that closes. Refs update at commit, before a fast Back/Escape event.
const actions = new Map<
  symbol,
  { priority: number; escape: boolean; run: () => boolean }
>();
function dispatch(event: Event, escapeOnly = false) {
  if (event.defaultPrevented) return;
  for (const action of [...actions.values()].sort(
    (a, b) => b.priority - a.priority,
  )) {
    if ((!escapeOnly || action.escape) && action.run()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
  }
}
const native = (event: Event) => dispatch(event);
// Bubble lets modal focus traps handle nested dialogs before the window router.
const keyboard = (event: KeyboardEvent) => {
  if (event.key === "Escape") dispatch(event, true);
};
export function useNativeBack(
  priority: number,
  action: () => boolean,
  escape = false,
) {
  const latest = useRef(action);
  useLayoutEffect(() => {
    latest.current = action;
  });
  useLayoutEffect(() => {
    const id = Symbol();
    if (!actions.size) {
      window.addEventListener("writely:back", native, true);
      window.addEventListener("keydown", keyboard);
    }
    actions.set(id, { priority, escape, run: () => latest.current() });
    return () => {
      actions.delete(id);
      if (!actions.size) {
        window.removeEventListener("writely:back", native, true);
        window.removeEventListener("keydown", keyboard);
      }
    };
  }, [priority, escape]);
}
