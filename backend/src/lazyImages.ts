// 입장 속도 개선: 방 상태를 보낼 때 큰 base64 이미지를 자리표시 이미지로 바꿔 먼저 보내고,
// 진짜 이미지는 바로 뒤에 따로 보낸다. (프론트엔드 utils/lazyImages.ts와 같은 값 사용)

// 1x1 투명 GIF + 식별용 fragment. 사용자가 직접 만들 일이 없는 값이라 "아직 안 받은 이미지" 표시로 안전하게 쓸 수 있음
export const LAZY_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#lazy";

const MIN_STRIP_LENGTH = 4096;

/** 큰 data URL 문자열을 LAZY_IMAGE로 바꾼 사본을 만든다. 바뀐 게 있으면 changed=true */
export function stripDataUrls<T>(value: T): { value: T; changed: boolean } {
  let changed = false;
  const walk = (v: any): any => {
    if (typeof v === "string") {
      if (v.length > MIN_STRIP_LENGTH && v.startsWith("data:")) { changed = true; return LAZY_IMAGE; }
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: any = {};
      for (const k of Object.keys(v)) out[k] = walk(v[k]);
      return out;
    }
    return v;
  };
  const result = walk(value);
  return { value: result, changed };
}

/** target 안의 LAZY_IMAGE 자리를 source의 같은 위치 값으로 채운다 (클라이언트가 자리표시 값을 그대로 돌려보낸 경우 보호) */
export function fillLazyImages(target: any, source: any): any {
  if (target === LAZY_IMAGE) return typeof source === "string" ? source : target;
  if (Array.isArray(target)) return target.map((t, i) => fillLazyImages(t, Array.isArray(source) ? source[i] : undefined));
  if (target && typeof target === "object") {
    const out: any = {};
    for (const k of Object.keys(target)) out[k] = fillLazyImages(target[k], source && typeof source === "object" ? source[k] : undefined);
    return out;
  }
  return target;
}
