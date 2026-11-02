// Fail closed for scripted playback; native user clicks remain YouTube's own flow.
export function canStartPlayback(shell: HTMLElement, automatic = true) {
  if (document.visibilityState !== "visible" || document.querySelector("dialog[open]")) return false;
  const frame = shell.querySelector("iframe");
  if (!frame) return false;
  const rect = frame.getBoundingClientRect();
  if (rect.width < 200 || rect.height < 200) return false;
  const left = Math.max(0, rect.left), top = Math.max(0, rect.top);
  const right = Math.min(window.innerWidth, rect.right), bottom = Math.min(window.innerHeight, rect.bottom);
  if (Math.max(0, right - left) * Math.max(0, bottom - top) <= rect.width * rect.height * (automatic ? 0.5 : 0)) return false;
  // Hit tests also detect clipping/overlays that a bounding box alone misses.
  let visible = 0;
  for (const x of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    for (const y of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const hit = document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y);
      if (hit === frame) visible++;
    }
  }
  return visible > (automatic ? 12 : 0);
}

let owner: { pause: () => void } | undefined;
export function claimPlayback(next: { pause: () => void }) {
  if (owner !== next) owner?.pause();
  owner = next;
}
export function releasePlayback(current: { pause: () => void }) {
  if (owner === current) owner = undefined;
}
