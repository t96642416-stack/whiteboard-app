// 업로드 이미지를 브라우저에서 줄이고 압축해서 data URL로 만든다.
// 원본(휴대폰 사진 3~5MB)을 그대로 저장하면 방에 들어올 때마다 전부 내려받아야 해서 느려짐.

const MAX_DIMENSION = 1600;
const QUALITY = 0.82;

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export interface ReadImageResult {
  dataUrl: string;
  mimeType: string;
}

/**
 * 이미지 파일 → 압축된 data URL.
 * GIF(움직임 유지)·SVG는 그대로 두고, 압축 결과가 원본보다 크면 원본을 쓴다.
 * 압축 중 문제가 생기면 원본으로 대체한다.
 */
export async function readImageFile(file: File): Promise<ReadImageResult> {
  const original = await readAsDataURL(file);
  const originalResult = { dataUrl: original, mimeType: file.type || "image/png" };
  if (file.type === "image/gif" || file.type === "image/svg+xml") return originalResult;

  try {
    const img = await loadImage(original);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return originalResult;
    ctx.drawImage(img, 0, 0, w, h);

    // WebP(투명 배경 유지)를 우선 시도, 브라우저가 지원하지 않으면 흰 배경 JPEG
    let dataUrl = canvas.toDataURL("image/webp", QUALITY);
    let mimeType = "image/webp";
    if (!dataUrl.startsWith("data:image/webp")) {
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
      mimeType = "image/jpeg";
    }

    return dataUrl.length < original.length ? { dataUrl, mimeType } : originalResult;
  } catch {
    return originalResult;
  }
}
