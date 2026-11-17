// Starts server.cjs, connects 2 fake phones, checks record relay + offline catch-up + LWW.
const { spawn } = require("child_process");
const WebSocket = require("ws");
const srv = spawn("node", ["server.cjs"], { stdio: "inherit" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await wait(800);
  const got = { A: [], B: [] };
  const mk = (n) => { const w = new WebSocket("ws://localhost:3000"); w.on("message", (m) => got[n].push(JSON.parse(m))); return w; };
  const A = mk("A"), B = mk("B"); await wait(400);
  A.send(JSON.stringify({ type: "upsert", record: { id: "RA-2026-0001", category: "RED", updatedAt: 100, deviceId: "a" } })); await wait(300);
  const t1 = got.B.some((m) => m.type === "upsert" && m.record.id === "RA-2026-0001");
  B.send(JSON.stringify({ type: "upsert", record: { id: "RA-2026-0001", category: "YELLOW", updatedAt: 50, deviceId: "b" } })); await wait(300);
  const t2 = !got.A.some((m) => m.type === "upsert" && m.record.category === "YELLOW"); // older write rejected
  const C = mk("C_late"); got.C_late = []; C.on("message", (m) => got.C_late.push(JSON.parse(m))); await wait(400);
  const t3 = got.C_late.some((m) => m.type === "sync" && m.records["RA-2026-0001"]?.category === "RED"); // late joiner gets state
  console.log(t1 ? "PASS" : "FAIL", "relay A->B");
  console.log(t2 ? "PASS" : "FAIL", "older write rejected (last-write-wins)");
  console.log(t3 ? "PASS" : "FAIL", "late joiner receives state");
  srv.kill(); process.exit(t1 && t2 && t3 ? 0 : 1);
})();
