// 서버(backend/src/lazyImages.ts)와 같은 값.
// 입장 직후엔 큰 이미지가 이 자리표시(1x1 투명 GIF)로 오고, 곧이어 "room-heavy-patch"로 진짜 이미지가 온다.
export const LAZY_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#lazy";

/** target 안의 LAZY_IMAGE 자리를 source의 같은 위치 값으로 채운다. 바뀐 게 없으면 target을 그대로 돌려준다 */
export function fillLazyImages<T>(target: T, source: any): T {
  const walk = (t: any, s: any): any => {
    if (t === LAZY_IMAGE) return typeof s === "string" ? s : t;
    if (Array.isArray(t)) {
      let changed = false;
      const out = t.map((x, i) => { const y = walk(x, Array.isArray(s) ? s[i] : undefined); if (y !== x) changed = true; return y; });
      return changed ? out : t;
    }
    if (t && typeof t === "object") {
      let changed = false;
      const out: any = {};
      for (const k of Object.keys(t)) {
        const y = walk(t[k], s && typeof s === "object" ? s[k] : undefined);
        if (y !== t[k]) changed = true;
        out[k] = y;
      }
      return changed ? out : t;
    }
    return t;
  };
  return walk(target, source);
}
