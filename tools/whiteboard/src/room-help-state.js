// Keep pointer hover separate from deliberate touch/keyboard disclosure.
// In particular, a mouse click must never pin a hover explanation open.
export function roomHelpState(state, event) {
  switch (event.type) {
    case "pointer-enter":
      return event.pointerType === "mouse" ? "hover" : state;
    case "pointer-leave":
      return state === "hover" ? null : state;
    case "focus":
      return event.keyboard ? "keyboard" : state;
    case "activate":
      if (event.pointerType === "mouse") return state;
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        return state === "touch" ? null : "touch";
      }
      return state || "keyboard";
    case "dismiss":
      return null;
    default:
      return state;
  }
}
