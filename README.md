# RelayAid – Kuldeep modules

| File | What |
|---|---|
| `public/triage.js` | START triage rule engine (+ SpO2/HR warnings, unreliable-sensor gating). Cutoffs in `THRESHOLDS`. |
| `public/vision.js` | Pupil light reflex check, torch/screen flash, tourniquet timestamp watermark. |
| `public/sync.js` | GPS extractor + hotspot WebSocket sync (offline queue, last-write-wins). |
| `public/index.html` | Demo page wiring all three. |
| `server.cjs` | Laptop server: static files + sync relay. |
| `test.js`, `sync-test.cjs` | Automated tests. |
| `triage.dart` | Dart port of the rule engine in case the app is Flutter. |

## Run
```
npm install
npm test                 # triage rules (144 combos + named cases)
node sync-test.cjs       # sync server integration test
```
### Phone testing (camera + GPS require HTTPS)
1. Turn on the hotspot; connect laptop and phones to it. Find the laptop IP (`ipconfig` / `ip a`).
2. `mkcert -install && mkcert <laptop-ip> localhost`
3. `CERT="<laptop-ip>+1.pem" KEY="<laptop-ip>+1-key.pem" npm start`   (Windows: `set CERT=...` then `set KEY=...`)
4. Open `https://<laptop-ip>:3000` on each phone (install mkcert's root CA on the phone, or accept the warning for the demo).
5. Classify → Save record → it appears on the other phone. Turn hotspot off/on: phones reconnect and re-sync.

## To fill in when Rishika answers
- `THRESHOLDS` (resp rate, SpO2, HR) in `triage.js`
- `INSTRUCTIONS` (step text per colour) in `triage.js`
- PLR `reactiveMinPct` (default 15, placeholder) in `vision.js`
- Watermark label/fields in `vision.js`
- 

## Known limits (say these in the demo)
- Torch flash works on Android Chrome only; iOS uses a screen flash (weaker).
- PLR is a prototype: lighting and camera dependent; not a medical measurement.
- Sync is last-write-wins; fine for demo, not for concurrent edits of the same field.
