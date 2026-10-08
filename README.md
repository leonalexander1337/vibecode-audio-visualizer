# VIBECODE // VISUALIZER

Audio-reaktiver Techno-Visualizer fürs Laptop-Mikrofon, gebaut für Party und Beamer.
Schwarz-weiß mit roten Akzenten, 16:9, Kick-Erkennung und BPM-Sync, drei Szenen in Endlosschleife.

Läuft komplett im Browser (WebGL2 + Web Audio). Es gibt keinen Server und nichts zu installieren
auf dem Gerät, das abspielt. Nach dem ersten Öffnen funktioniert die Seite auch offline.

---

## Benutzen

1. Seite in **Chrome** öffnen (GitHub-Pages-URL oder lokal, siehe unten).
2. **START · MIKROFON** klicken und den Mikrofonzugriff erlauben.
3. Fenster auf den Beamer ziehen und **F** für Vollbild drücken.
4. **H** zeigt das Overlay mit BPM, Pegel und allen Tasten.

Ohne Mikrofon zum Ausprobieren: **DEMO-BEAT** (128 BPM, mit Breakdown und Drop alle 32 Takte).
`?bpm=140` an der URL ändert das Demo-Tempo.

### Tasten

| Taste | Funktion | Taste | Funktion |
|---|---|---|---|
| `1` … `6` | Szene wählen | `←` `→` | Szene vor/zurück |
| `P` | nächste Farbpalette | `Shift`+`P` | vorherige Farbpalette |
| `Leertaste` | FX-Burst (manueller Drop) | `B` | Blackout |
| `T` | Tap-Tempo (≥ 3× tippen) | `L` | BPM sperren/freigeben |
| `,` `.` | Sync: Bild früher/später (10 ms, halten geht) | `+` `-` | Kick empfindlicher/weniger |
| `S` | Strobe an/aus | `G` | Glitch aus/dosiert/heftig |
| `R` | Auflösung Auto/100/75/50 % | `A` | Auto-Szenenwechsel (alle 32 Takte) |
| `W` | Webcam-Einblendungen an/aus | `V` | Webcam ein (bleibt, bis nochmal `V`) / aus |
| `Shift`+`V` | Webcam kurz einblenden (5–10 s) | | |
| `M` | nächstes Mikrofon | `D` | Demo-Beat an/aus |
| `C` | Control-Panel (Maus) | `H` | Overlay/Hilfe |
| `F` / Doppelklick | Vollbild | | |

Einstellungen (Strobe, Glitch, Sync, Webcam, Mikrofon …) werden im Browser gespeichert.

### Control-Panel (`C`)

- **SYNC-Fader** (−500 … +500 ms): Plus heißt, das Bild kommt später, Minus heißt, das Bild kommt früher.
  Daneben blinkt eine **Beat-Lampe** auf dem Beat, so wie das Bild ihn sieht. Den Fader so lange schieben, bis die
  Lampe genau mit der Kick blinkt, die du hörst. `0` setzt zurück.
  - Typisch: Der Beamer hängt hinterher (30–100 ms), dann ins Minus schieben.
  - Bei Plus werden auch Bass/Pegel/Kick-Reaktionen verzögert, nicht nur das Beat-Raster.
- **WEBCAM**: Einblendungen an/aus. **EIN/AUS** blendet sofort ein und lässt das Bild drin, bis du nochmal
  klickst (wie `V`). **KURZ** blendet für 5–10 s ein (wie `Shift`+`V`). Beide blenden eine laufende Einblendung aus.
  Der Status zeigt, wann die nächste automatische Einblendung kommt.

### Webcam-Einblendungen

Alle ~1,5–3 Minuten wird für 5–10 Sekunden das Webcam-Bild eingeblendet. Der Start liegt immer auf einer
Takt-Eins und die Dauer auf ganzen Takten.

**Datamosh-Übergänge (je 1 Takt):** Wie bei einem Video ohne Keyframes wird das alte Bild nicht ersetzt,
sondern von der Bewegung des neuen mitgerissen. Die Bewegung wird per Block-Matching (wie ein Videocodec,
in Makroblöcken) live geschätzt.
- **Rein:** Die Visuals reiten auf der Kamera-Bewegung, gleiten zu den hellen Formen und verblassen im Dunkeln.
  Der Würfel zieht sich so in die Form von Gesicht und Person. Dann bluten die Kanten ein, am Ende ist das Kamerabild voll da.
- **Raus:** umgekehrt. Das Gesicht wird von der Bewegung der Visuals mitgerissen und zieht sich in deren Formen.

Es gibt keine echte Gesichtserkennung: Im dunklen Raum ist die Person der hellste Bereich, das reicht für den Effekt.

**Look:** gespiegelt, komplementäre (invertierte) Farben, solarisiert, Farbton rotiert im Beat, grob posterisiert,
pumpt mit der Kick. Die Szenen bleiben schwarz/weiß/rot, nur die Webcam darf bunt sein.
**Dunkler Raum:** automatische Belichtung über die mittlere Bildhelligkeit, Sensorrauschen wird vor der Verstärkung
abgeschnitten (dunkel bleibt schwarz), Bewegung zählt erst über einer Rauschschwelle.

Die Kamera wird nur ~4 Takte vorher eingeschaltet und danach wieder aus. Die Berechtigung wird beim Start
abgefragt, damit kein Dialog mitten auf der Party auf dem Beamer aufpoppt.

### Szenen

1. **MONOLITH**: Flug durch einen Korridor rotierender Rahmen, pro Beat ein Rahmen. Säulen wachsen mit dem Bass.
2. **KALEIDO**: Kaleidoskop über einem Kaliset-Fraktal. Segmentzahl und Drift wechseln alle 8 Takte, Ringe auf jedem Beat.
3. **FRACTAL**: 3D-KIFS-Fraktal (Raymarching) mit rot wandernden Adern. Abwechselnd Orbit und Flug ganz nah ran.
4. **MERCURY**: flüssiges Chrom. Sechs Metall-Blobs treiben im Beat, schmelzen ineinander und reißen wieder
   auseinander. Die Kick bläht sie auf, die Höhen kräuseln die Oberfläche.
5. **SPLIT**: asymmetrisches Raster im Stil Schweizer Plakate. Rekursiv in ungleiche Blöcke zerschnitten, die großen
   Schnitte wechseln jeden Takt, die kleinen jeden Beat. Jeder Block hat sein eigenes Muster, einige brennen rot.
6. **RIDGES**: gestapelte Kammlinien à la „Unknown Pleasures“. Die Landschaft rollt eine Linie pro Beat auf dich zu,
   die Gipfel sitzen außermittig und wachsen mit dem Bass.

### Farbpaletten (`P`)

| | Schwarz → | Weiß → | Rot → |
|---|---|---|---|
| **BLUT** | Schwarz | Weiß | Rot |
| **ACID** | Schwarz | Grünweiß | Säuregrün |
| **UV** | Tiefviolett | Lavendel | Magenta |
| **GLUT** | Schwarz | Bernstein | Orange-Rot |
| **EIS** | Nachtblau | Eisweiß | Kobaltblau |

Die Szenen rendern intern weiter schwarz/weiß/rot, erst der letzte Pass färbt um. Wechsel werden kurz überblendet,
die Webcam behält ihre eigenen Farben. Die Palette lässt sich auch im Control-Panel (`C`) per Farbfeld wählen.
Neue Paletten: `src/gfx/palettes.ts`.

Über allen Szenen liegen Glitch, Datamosh, Strobe und Invert. Sie sind dosiert und auf Takte und Drops getimt
(siehe `src/director/Director.ts`). Strobe blitzt nie öfter als ~3× pro Sekunde.

---

## Party-Checkliste

- **Chrome** benutzen. Safari geht meist auch, ist aber weniger getestet.
- **Mikrofon-Pegel:** Im Overlay (`H`) darf `EINGANG` nicht dauerhaft `CLIPPING` zeigen.
  - Windows: *Einstellungen → System → Sound → Eingabe → Mikrofon* → Lautstärke auf ca. 30–50 %.
  - macOS: *Systemeinstellungen → Ton → Eingang* → Eingangslautstärke ca. ein Drittel.
- **Windows-„Audioverbesserungen“ aus** (gleiche Seite, *Audioverbesserungen: Aus*). Die Rauschunterdrückung
  von Intel Smart Sound bügelt sonst Kicks platt.
- **BPM-Anzeige prüfen:** Steht `SYNC`, ist alles gut. Bei falschem Tempo: `T` im Takt tippen, ggf. `L` zum Sperren.
- **Bild zu spät/zu früh?** `C` → SYNC-Fader schieben, bis die Beat-Lampe mit der Kick blinkt (oder `,` / `.`).
- **Webcam:** Beim Start Kamera erlauben. Auf dem Mac braucht Chrome außerdem die Kamera-Freigabe in
  *Systemeinstellungen → Datenschutz & Sicherheit → Kamera*. Keine Einblendungen gewünscht? `W`.
- **Ruckelt es?** `R` auf Auto lassen (regelt selbst runter) oder fest auf 75 %/50 % stellen.
- **Netzteil anstecken.** Integrierte GPUs takten im Akkubetrieb runter.
- Display-Ruhezustand wird von der App blockiert, solange sie sichtbar ist.

### MacBook (M1) ohne Entwickler-Tools

Nichts installieren: die GitHub-Pages-URL in Chrome öffnen, fertig. Optional in Chrome über
*⋮ → Streamen, speichern und teilen → Seite als App installieren* als eigene App ins Dock legen.
Das MacBook-Display ist 16:10, die App zeigt dort automatisch schwarze Balken. Am 16:9-Beamer gibt es keine Balken.

Für Offline-Partys: die Seite **einmal mit Internet öffnen**. Danach ist alles im Browser-Cache und läuft ohne Netz.

---

## Entwicklung

Voraussetzung: Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Beat-Tracking-Tests mit synthetischem Techno
npm run build      # Typecheck + Produktions-Build nach dist/
npm run preview    # Build lokal ansehen (inkl. Offline-Service-Worker)
```

### Deployment (GitHub Pages)

Jeder Push auf `main` testet, baut und deployt über `.github/workflows/deploy.yml`.
Einmalig im Repo einstellen: **Settings → Pages → Source: GitHub Actions**.

### Architektur

```
Mikrofon ─▶ AudioWorklet (BandSplitter)  ── Kick-Band/Hi-Hat-Band-Energie alle ~10 ms ──┐
        └─▶ AnalyserNode (Spectrum)       ── Bass/Mitten/Höhen, selbst-normalisierend ───┤
                                                                                        ▼
            BeatTracker: OnsetDetector → KickDetector ─┬─▶ BeatClock (phasengekoppeltes Beat-Raster)
                                        TempoEstimator ┘    (Autokorrelation + Peak-Fit)
                                                                                        ▼
            MusicAnalyzer (MusicFrame pro Bild) ─▶ Director (wann welche FX) ─▶ Renderer
                                                                                        ▼
            Szene (Raymarching/2D) → Post (Glitch, Datamosh, Trails, Palette) → Output (16:9, Strobe)
```

| Ordner | Inhalt |
|---|---|
| `src/audio/dsp/` | Reine DSP-Logik ohne Browser-APIs, mit Vitest getestet |
| `src/audio/` | Web-Audio-Anbindung, Demo-Beat, Spektrum |
| `src/director/` | Musikalisches Timing der Effekte und Webcam-Einblendungen (`CamShow`, getestet) |
| `src/video/` | Webcam-Zugriff |
| `src/ui/` | HUD, Toasts, Control-Panel |
| `src/gfx/` | WebGL2-Renderer und Post-Shader |
| `src/scenes/` | Szenen-Shader (`.frag`). Neue Szene = Datei anlegen + in `index.ts` eintragen |
| `src/app/` | App-Loop, Tasten, Einstellungen, Auto-Auflösung |

**Beat-Tracking kurz erklärt:** Der Kick-Bereich (< 120 Hz) wird pro Hop in Energie umgerechnet, log-komprimiert
und pegelunabhängig normalisiert. Ein adaptiver Peak-Picker findet Kicks. Die Autokorrelation des Onset-Signals
liefert das Tempo, auf ±0,05 BPM genau, weil Peaks bei bis zu 8 Beats Abstand gefittet werden. Ein
phasengekoppeltes Raster zieht sich an jeden Kick heran. Ein nach Kick-Stärke gewichtetes Phasenhistogramm
verhindert, dass es auf Offbeat-Bass einrastet. Im gelockten Zustand pulsiert das Bild auf dem *vorhergesagten*
Beat, ohne Erkennungsverzögerung.

### Bekannte Grenzen / Ideen

- Feste Bilder/Logos einblenden ist noch nicht eingebaut (der Kamera-Pfad im Post-Shader wäre die Vorlage).
- Taktanfang (Downbeat) wird nur an Drops neu ausgerichtet.
- Nach einem Grafiktreiber-Absturz sperrt Chrome WebGL bis zum Browser-Neustart. Die App senkt danach
  vorsorglich die Auflösung.
