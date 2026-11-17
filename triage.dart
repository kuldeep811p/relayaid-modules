// Dart port of public/triage.js (use if the app is Flutter).
enum Category { green, yellow, red, black }

class Thresholds {
  final int respRateRed;
  final double capRefillRedSec;
  final int spo2Low;
  final int hrHigh;
  const Thresholds({this.respRateRed = 30, this.capRefillRedSec = 2, this.spo2Low = 90, this.hrHigh = 120});
}

class Patient {
  final bool walking, breathing, breathingAfterReposition, followsCommands;
  final int respRate;
  final bool? radialPulse;
  final double? capRefillSec;
  final int? spo2, hr;
  final String vitalsStatus; // valid | unreliable | unavailable
  const Patient({
    this.walking = false, this.breathing = true, this.breathingAfterReposition = true,
    this.followsCommands = true, this.respRate = 20, this.radialPulse = true,
    this.capRefillSec, this.spo2, this.hr, this.vitalsStatus = 'valid',
  });
}

class TriageResult {
  final Category category;
  final String reason;
  final List<String> path, warnings;
  TriageResult(this.category, this.reason, this.path, this.warnings);
}

List<String> vitalWarnings(Patient p, [Thresholds t = const Thresholds()]) {
  if (p.vitalsStatus != 'valid') return ['Sensor reading ${p.vitalsStatus}: not used'];
  final w = <String>[];
  if (p.spo2 != null && p.spo2! < t.spo2Low) w.add('SpO2 ${p.spo2}% < ${t.spo2Low}%');
  if (p.hr != null && p.hr! > t.hrHigh) w.add('HR ${p.hr} > ${t.hrHigh} BPM');
  return w;
}

TriageResult triage(Patient p, [Thresholds t = const Thresholds()]) {
  final path = <String>[];
  final warnings = vitalWarnings(p, t);
  TriageResult done(Category c, String r) => TriageResult(c, r, path, warnings);

  path.add('Can walk?');
  if (p.walking) return done(Category.green, 'Walking wounded');

  path.add('Breathing?');
  if (!p.breathing) {
    path.add('Breathing after airway repositioning?');
    return p.breathingAfterReposition
        ? done(Category.red, 'Breathing only after airway repositioned')
        : done(Category.black, 'Not breathing after airway opened');
  }

  path.add('Resp rate > ${t.respRateRed}?');
  if (p.respRate > t.respRateRed) return done(Category.red, 'Respiratory rate ${p.respRate} > ${t.respRateRed}');
  path.add('Perfusion (radial pulse / cap refill)?');
  final bad = p.radialPulse == false ||
      (p.radialPulse == null && p.capRefillSec != null && p.capRefillSec! > t.capRefillRedSec);
  if (bad) return done(Category.red, 'Poor perfusion (no radial pulse / slow cap refill)');

  path.add('Mental status: follows simple commands?');
  if (!p.followsCommands) return done(Category.red, 'Cannot follow simple commands');

  return done(Category.yellow, 'Delayed: breathing, perfused, obeys commands, cannot walk');
}
