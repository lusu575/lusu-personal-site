// The live button disappears on commit. Let only its ink recoil, without
// delaying native activation, duplicating the button, or moving its focus.
export function releaseIcon(button, keyboard) {
  const glyph = button.querySelector('.pond-glyph');
  if (!glyph?.animate || window.LusuUiMotion?.getMode() !== 'full') return;
  const rect = glyph.getBoundingClientRect();
  const path = glyph.querySelector('path');
  if (!path || !rect.width) return;
  const echo = glyph.cloneNode(false);
  echo.setAttribute('class', 'pond-launch-echo');
  const ink = path.cloneNode(false);
  ink.removeAttribute('id');
  echo.append(ink);
  Object.assign(echo.style, {
    left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`
  });
  document.body.append(echo);
  const frames = [
    { transform: 'scale(1.02,.92)', opacity: .95 },
    { transform: 'scale(.99,1.03)', opacity: .78, offset: .62 },
    { transform: 'scale(1)', opacity: 0 }
  ];
  // Enter clicks on keydown; it may have had no painted :active frame.
  if (keyboard) frames.unshift({ transform: 'scale(1)', opacity: 1 });
  const animation = echo.animate(frames, { duration: keyboard ? 200 : 140, easing: 'ease-out' });
  animation.finished.then(() => echo.remove(), () => echo.remove());
}
