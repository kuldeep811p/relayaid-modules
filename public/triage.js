// triage.js — START (Simple Triage and Rapid Treatment), adult algorithm.
// Pure functions, no DOM, so Dheeraj can import it straight into app state.
// All cutoffs live in THRESHOLDS: change numbers here once Rishika confirms.

export const THRESHOLDS = {
  respRateRed: 30,        // START: > 30 breaths/min -> RED
  capRefillRedSec: 2,     // START: > 2 s -> RED (used only if radial pulse not checked)
  // Vital-sign danger flags from Rishika's research (PPG layer, NOT part of classic START):
  spo2Low: 90,            // SpO2 < 90 %
  hrHigh: 120,            // HR > 120 BPM
};

export const CATEGORY = { GREEN: "GREEN", YELLOW: "YELLOW", RED: "RED", BLACK: "BLACK" };

/**
 * input = {
 *   walking: boolean,
 *   breathing: boolean,                 // spontaneous breathing present
 *   breathingAfterReposition: boolean,  // only needed when breathing === false
 *   respRate: number,                   // breaths/min
 *   radialPulse: boolean,               // radial pulse palpable
 *   capRefillSec: number | null,        // optional fallback to radialPulse
 *   followsCommands: boolean,
 *   spo2?: number, hr?: number          // optional PPG data -> only adds warnings
 * }
 * returns { category, reason, path[], warnings[] }
 */
export function triage(p, T = THRESHOLDS) {
  const path = [];
  const warnings = vitalWarnings(p, T);
  const done = (category, reason) => ({ category, reason, path, warnings });

  path.push("Can walk?");
  if (p.walking) return done(CATEGORY.GREEN, "Walking wounded");

  path.push("Breathing?");
  if (!p.breathing) {
    path.push("Breathing after airway repositioning?");
    if (!p.breathingAfterReposition) return done(CATEGORY.BLACK, "Not breathing after airway opened");
    return done(CATEGORY.RED, "Breathing only after airway repositioned");
  }

  path.push(`Resp rate > ${T.respRateRed}?`);
  if (p.respRate > T.respRateRed) return done(CATEGORY.RED, `Respiratory rate ${p.respRate} > ${T.respRateRed}`);

  path.push("Perfusion (radial pulse / cap refill)?");
  const perfusionBad =
    p.radialPulse === false ||
    (p.radialPulse == null && p.capRefillSec != null && p.capRefillSec > T.capRefillRedSec);
  if (perfusionBad) return done(CATEGORY.RED, "Poor perfusion (no radial pulse / slow cap refill)");

  path.push("Mental status: follows simple commands?");
  if (!p.followsCommands) return done(CATEGORY.RED, "Cannot follow simple commands");

  return done(CATEGORY.YELLOW, "Delayed: breathing, perfused, obeys commands, cannot walk");
}

// Sensor-based warnings. They do NOT change the START colour (keeps START pure);
// the UI can show them as a banner or escalate YELLOW -> RED if the team decides so.
export function vitalWarnings(p, T = THRESHOLDS) {
  const w = [];
  // p.vitalsStatus: "valid" | "unreliable" | "unavailable" (from signal-quality check).
  // Unreliable readings must never drive a warning or be reused as if confirmed.
  if (p.vitalsStatus && p.vitalsStatus !== "valid") {
    return [`Sensor reading ${p.vitalsStatus}: not used`];
  }
  if (p.spo2 != null && p.spo2 < T.spo2Low) w.push(`SpO2 ${p.spo2}% < ${T.spo2Low}%`);
  if (p.hr != null && p.hr > T.hrHigh) w.push(`HR ${p.hr} > ${T.hrHigh} BPM`);
  return w;
}

// Output shape for app state. Rishika's step text is plugged in here.
export const INSTRUCTIONS = {
  RED:    ["TODO from Rishika: immediate-care steps"],
  YELLOW: ["TODO from Rishika: monitor + delayed-care steps"],
  GREEN:  ["TODO: minor care, reassess"],
  BLACK:  ["TODO: no resuscitation in mass-casualty; move on to next patient"],
};

export function triageResult(p) {
  const r = triage(p);
  return { ...r, instructions: INSTRUCTIONS[r.category], at: Date.now() };
}

// Quick self-test: node triage.js
if (typeof process !== "undefined" && process.argv[1]?.endsWith("triage.js")) {
  const cases = [
    [{ walking: true }, "GREEN"],
    [{ walking: false, breathing: false, breathingAfterReposition: false }, "BLACK"],
    [{ walking: false, breathing: true, respRate: 34 }, "RED"],
    [{ walking: false, breathing: true, respRate: 20, radialPulse: false }, "RED"],
    [{ walking: false, breathing: true, respRate: 20, radialPulse: true, followsCommands: false }, "RED"],
    [{ walking: false, breathing: true, respRate: 20, radialPulse: true, followsCommands: true }, "YELLOW"],
  ];
  for (const [c, want] of cases) console.log(triage(c).category === want ? "PASS" : "FAIL", want);
}
