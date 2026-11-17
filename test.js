import { triage, CATEGORY as C } from "./public/triage.js";
const base = { walking: false, breathing: true, breathingAfterReposition: true, respRate: 20, radialPulse: true, capRefillSec: null, followsCommands: true };
const cases = [
  ["walking -> GREEN", { walking: true }, C.GREEN],
  ["walking ignores other bad vitals", { walking: true, respRate: 40 }, C.GREEN],
  ["not breathing, none after reposition -> BLACK", { ...base, breathing: false, breathingAfterReposition: false }, C.BLACK],
  ["not breathing, breathes after reposition -> RED", { ...base, breathing: false, breathingAfterReposition: true }, C.RED],
  ["RR 31 -> RED", { ...base, respRate: 31 }, C.RED],
  ["RR 30 not RED by RR", { ...base, respRate: 30 }, C.YELLOW],
  ["RR 12 -> YELLOW", { ...base, respRate: 12 }, C.YELLOW],
  ["no radial pulse -> RED", { ...base, radialPulse: false }, C.RED],
  ["pulse unknown, cap refill 3s -> RED", { ...base, radialPulse: null, capRefillSec: 3 }, C.RED],
  ["pulse unknown, cap refill 2s -> YELLOW", { ...base, radialPulse: null, capRefillSec: 2 }, C.YELLOW],
  ["cannot follow commands -> RED", { ...base, followsCommands: false }, C.RED],
  ["all ok but cannot walk -> YELLOW", base, C.YELLOW],
  ["low SpO2 stays YELLOW but warns", { ...base, spo2: 85 }, C.YELLOW],
];
let fail = 0;
for (const [name, input, want] of cases) {
  const r = triage(input);
  const ok = r.category === want;
  if (!ok) fail++;
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : `(got ${r.category})`);
}
const w = triage({ ...base, spo2: 85, hr: 130 }).warnings;
const okW = w.length === 2; if (!okW) fail++;
console.log(okW ? "PASS" : "FAIL", "SpO2/HR warnings raised");
const u = triage({ ...base, spo2: 70, hr: 200, vitalsStatus: "unreliable" }).warnings;
const okU = u.length === 1 && u[0].includes("not used"); if (!okU) fail++;
console.log(okU ? "PASS" : "FAIL", "unreliable vitals ignored");
// exhaustive: every combination yields a valid category and a non-empty path
const B = [true, false], cats = new Set(Object.values(C));
let n = 0;
for (const walking of B) for (const breathing of B) for (const rep of B) for (const rr of [8, 20, 35]) for (const pulse of [true, false, null]) for (const cmd of B) {
  const r = triage({ walking, breathing, breathingAfterReposition: rep, respRate: rr, radialPulse: pulse, capRefillSec: 1, followsCommands: cmd });
  if (!cats.has(r.category) || !r.path.length || !r.reason) fail++;
  n++;
}
console.log(`Exhaustive: ${n} combinations checked`);
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
process.exit(fail ? 1 : 0);
