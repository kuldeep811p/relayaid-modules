// sync.js — browser side: GPS extractor + WebSocket sync over local hotspot.
// Merge rule: last-write-wins per record id (updatedAt, tie-break deviceId). Good enough for a demo.

// ---------- GPS ----------
export function getLocation({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Geolocation unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        latitude: p.coords.latitude, longitude: p.coords.longitude,
        accuracy: p.coords.accuracy, timestamp: p.timestamp,
      }),
      (e) => reject(new Error(["", "Permission denied", "Position unavailable", "Timeout"][e.code] || e.message)),
      { enableHighAccuracy: true, timeout, maximumAge: 5000 }
    );
  });
}

export function watchLocation(cb, errCb = console.warn) {
  const id = navigator.geolocation.watchPosition(
    (p) => cb({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, timestamp: p.timestamp }),
    errCb, { enableHighAccuracy: true, maximumAge: 2000 });
  return () => navigator.geolocation.clearWatch(id);
}

// ---------- Sync ----------
const DEVICE_ID = (() => {
  let id = localStorage.getItem("deviceId");
  if (!id) { id = Math.random().toString(36).slice(2, 8); localStorage.setItem("deviceId", id); }
  return id;
})();

export class HotspotSync {
  constructor({ onChange = () => {}, onStatus = () => {} } = {}) {
    this.records = JSON.parse(localStorage.getItem("records") || "{}");
    this.onChange = onChange; this.onStatus = onStatus;
    this.ws = null; this.retry = 0;
    // The app is served by the same laptop, so location.host = laptop-ip:port.
    this.url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
    this.connect();
  }
  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.retry = 0; this.onStatus("online");
      this.ws.send(JSON.stringify({ type: "sync", records: this.records })); // push offline edits
    };
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "sync") for (const r of Object.values(m.records)) this.merge(r);
      if (m.type === "upsert") this.merge(m.record);
    };
    this.ws.onclose = () => {
      this.onStatus("offline");
      setTimeout(() => this.connect(), Math.min(1000 * 2 ** this.retry++, 10000));
    };
  }
  merge(r) {
    const cur = this.records[r.id];
    const newer = !cur || r.updatedAt > cur.updatedAt || (r.updatedAt === cur.updatedAt && r.deviceId > cur.deviceId);
    if (!newer) return;
    this.records[r.id] = r;
    localStorage.setItem("records", JSON.stringify(this.records));
    this.onChange(r, this.records);
  }
  // e.g. save({id:"patient-12", category:"RED", coords, photo:dataUrl})
  save(data) {
    const r = { ...data, updatedAt: Date.now(), deviceId: DEVICE_ID };
    this.merge(r);
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ type: "upsert", record: r }));
    return r;
  }
}
