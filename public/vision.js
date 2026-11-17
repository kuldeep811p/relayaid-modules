// vision.js — client-side PLR check + tourniquet timestamp watermark. No libraries.
// Needs HTTPS (or localhost) for camera access.

export async function startCamera(videoEl, facing = "environment") {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

// Torch works on Android Chrome (rear camera). iOS Safari does NOT support it.
// Fallback: flash the screen white and use the front camera (see screenFlash).
export async function setTorch(stream, on) {
  const track = stream.getVideoTracks()[0];
  const caps = track.getCapabilities?.() || {};
  if (!caps.torch) return false;
  await track.applyConstraints({ advanced: [{ torch: on }] });
  return true;
}

export function screenFlash(ms = 300) {
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;inset:0;background:#fff;z-index:99999";
  document.body.appendChild(d);
  setTimeout(() => d.remove(), ms);
}

// ---------- PLR ----------
// Idea: pupil = dark blob inside a small ROI around the eye (user aligns eye in an on-screen circle).
// Flash changes overall brightness, so we do NOT compare mean luminance.
// We compare the DARK-PIXEL AREA, with the threshold recomputed per frame (mean - k*std).

function pupilArea(videoEl, roi, k = 1.0) {
  const c = pupilArea.c || (pupilArea.c = document.createElement("canvas"));
  c.width = roi.w; c.height = roi.h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(videoEl, roi.x, roi.y, roi.w, roi.h, 0, 0, roi.w, roi.h);
  const { data } = ctx.getImageData(0, 0, roi.w, roi.h);
  const lum = new Float32Array(roi.w * roi.h);
  let sum = 0;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    lum[j] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += lum[j];
  }
  const mean = sum / lum.length;
  let v = 0;
  for (const l of lum) v += (l - mean) ** 2;
  const thr = mean - k * Math.sqrt(v / lum.length);
  let dark = 0;
  for (const l of lum) if (l < thr) dark++;
  return dark;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs: baseline (pre-flash) -> flash -> sample 1.5 s.
 * roi = {x,y,w,h} in video pixels. Returns constriction % and a verdict.
 * Thresholds (>= ~15 % = reactive) are PLACEHOLDERS: calibrate on the team + confirm with Rishika.
 */
export async function pupillaryLightReflex(videoEl, stream, roi, opts = {}) {
  const { reactiveMinPct = 15, flashFn = null } = opts;
  const pre = [];
  for (let i = 0; i < 8; i++) { pre.push(pupilArea(videoEl, roi)); await sleep(60); }
  const baseline = pre.reduce((a, b) => a + b, 0) / pre.length;

  const torchOk = await setTorch(stream, true);
  if (!torchOk) (flashFn || screenFlash)(1500);

  const post = [];
  for (let i = 0; i < 15; i++) { await sleep(100); post.push(pupilArea(videoEl, roi)); }
  if (torchOk) await setTorch(stream, false);

  const minPost = Math.min(...post);
  const deltaPct = baseline > 0 ? ((baseline - minPost) / baseline) * 100 : 0;
  return {
    baseline, minPost, deltaPct: Math.round(deltaPct * 10) / 10,
    verdict: baseline < 20 ? "UNRELIABLE" : deltaPct >= reactiveMinPct ? "REACTIVE" : "SLUGGISH_OR_FIXED",
    method: torchOk ? "torch" : "screen-flash",
  };
}

// ---------- Tourniquet timestamp watermark ----------
// Draws the current video frame (or an <img>) to a canvas and burns in time + GPS + label.
export async function watermarkedPhoto(sourceEl, { label = "TOURNIQUET APPLIED", coords = null, time = new Date() } = {}) {
  const w = sourceEl.videoWidth || sourceEl.naturalWidth;
  const h = sourceEl.videoHeight || sourceEl.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(sourceEl, 0, 0, w, h);

  const lines = [
    label,
    time.toLocaleString("en-IN", { hour12: false }),
    coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} (±${Math.round(coords.accuracy)}m)` : "GPS n/a",
  ];
  const fs = Math.round(w / 28), pad = fs * 0.5;
  ctx.font = `bold ${fs}px monospace`;
  const bw = Math.max(...lines.map((t) => ctx.measureText(t).width)) + pad * 2;
  const bh = lines.length * fs * 1.25 + pad;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(w - bw - pad, h - bh - pad, bw, bh);
  ctx.fillStyle = "#ffeb3b";
  lines.forEach((t, i) => ctx.fillText(t, w - bw, h - bh + fs * (i + 1.05)));

  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
  return { blob, dataUrl: c.toDataURL("image/jpeg", 0.9), isoTime: time.toISOString() };
}
