// server.js — run on the laptop that hosts the hotspot (or is connected to it).
//   npm init -y && npm i ws
//   (HTTPS, needed for camera + GPS on phones)  mkcert -install && mkcert <laptop-ip> localhost
//       -> produces <laptop-ip>+1.pem and <laptop-ip>+1-key.pem ; set CERT/KEY below.
//   node server.js        then open https://<laptop-ip>:3000 on every phone.
//
// Serves the built app from ./public and relays/merges records over WebSocket.

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { WebSocketServer } = require("ws");

const PORT = 3000;
const CERT = process.env.CERT, KEY = process.env.KEY; // paths to mkcert files; omit for plain http (camera/GPS will fail on phones)
const PUBLIC = path.join(__dirname, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };

const handler = (req, res) => {
  let f = path.join(PUBLIC, req.url === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    res.end(buf);
  });
};

const server = CERT && KEY
  ? https.createServer({ cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) }, handler)
  : http.createServer(handler);

const state = {}; // id -> record
const wss = new WebSocketServer({ server });

const newer = (a, b) => !b || a.updatedAt > b.updatedAt || (a.updatedAt === b.updatedAt && a.deviceId > b.deviceId);

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "sync", records: state }));
  ws.on("message", (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const incoming = m.type === "sync" ? Object.values(m.records) : m.type === "upsert" ? [m.record] : [];
    for (const r of incoming) {
      if (!newer(r, state[r.id])) continue;
      state[r.id] = r;
      for (const c of wss.clients) if (c !== ws && c.readyState === 1) c.send(JSON.stringify({ type: "upsert", record: r }));
    }
    if (m.type === "sync") ws.send(JSON.stringify({ type: "sync", records: state })); // return what the client lacks
  });
});

server.listen(PORT, "0.0.0.0", () => console.log(`Listening on :${PORT}`));
