# Android-Schreiboberfläche – Redesign

Basis: Writer-A1 `b3e46b4`, auf PR #1 → #2 → #3 → #4. Der separate UI-Branch erhält sämtliche bisherigen gemeinsamen Dokumentwerkzeuge. Es lag in diesem Auftrag kein sichtbarer Screenshot vor; die Gestaltung setzt die ausdrücklich beschriebenen Merkmale um, keine behauptete Bildanalyse und keine fremden Assets.

## Gestaltung und tatsächliche Bedienung

- Kompakte Kopfzeile: Zurück, direkt editierbarer Titel, Lesemodus, Drei-Punkte-Aktionen. Export, Versionsauswahl, Speichern, Duplizieren, Einstellungen und Sperre bleiben im Aktionsmenü erreichbar. Umbenennen fokussiert und markiert den Titel; Dokumentinformationen zeigen echte Statistiken.
- Eine horizontale Werkzeugzeile direkt unter der Kopfzeile ersetzt die mehrzeilige untere Leiste. Keine abgeschnittenen Werkzeuge: Touch-Scroll und Tastaturfokus bleiben möglich. Aktive Marks werden auch bei Stored-Mark-Transaktionen aktualisiert.
- Viel Schreibfläche ohne Papierattrappe. Der Inhalt scrollt innerhalb des verfügbaren Viewports; Kopf und Werkzeuge bleiben erreichbar. visualViewport/Resize liefert die echte Höhe, kein fest geschätzter Tastaturversatz. Die Auswahl wird nicht für die Darstellung ins Dokument geschrieben.
- Dunkelgrau, Hell, System und AMOLED-Schwarz gelten für Bibliothek und Editor. Vorhandene Einstellungen werden respektiert; nur neue Sitzungen ohne Einstellung starten dunkel.
- Kontext: Tabellen bieten direkte Zeilen-/Spaltenaktionen; ausgewählte Bilder öffnen die vorhandenen vollständigen Bildwerkzeuge. Weitere gemeinsame Werkzeuge stehen weiterhin in den Kontextbereichen bereit. Tablets behalten Tabs und eine optionale Werkzeug-Seitenleiste.
- Fokusmodus blendet die Werkzeugzeile aus und lässt sich aus der Kopfzeile/Escape/Zurück verlassen. Lesemodus deaktiviert die Bearbeitung. Zurück schließt zunächst Editorüberlagerungen; Speicherung und verschlüsselter Bibliothekswechsel bleiben erhalten.
- Status zeigt Wörter, Zeichen, Lesezeit und den tatsächlichen Speicherzustand. Keine automatisch erfundenen Seitenzahlen.

## Parität und bewusst offene Funktionen

Die vollständigen Tabellen in ANDROID-PARITY.md und WRITER-ROADMAP.md gelten weiter. Dieses Redesign entfernt keine dokumentierten Werkzeuge und stellt keine neuen Konverter-/Sicherheitsfunktionen nur optisch dar.

| Funktion | Vorher | Nachher / Nachweis |
|---|---|---|
| Titel, Navigation, Dokumentaktionen | mehrere dauerhaft sichtbare Bereiche | kompakte Kopfzeile und bedienbares Menü |
| Textwerkzeuge | mehrzeilige fixierte untere Leiste | horizontale obere Zeile; bestehende Commands |
| Tabellen/Bilder | tiefe Kontextbereiche | zusätzliche direkte Kontextaktionen |
| Dark/Light/System | vorhanden | einheitliche Palette plus AMOLED |
| Fokus/Lesemodus | vorhanden | explizite Ausstiegsmöglichkeit, Bearbeitung gesperrt |
| Auswahl/IME | native Auswahl, adjustResize | Fokus erhaltende Werkzeuggesten und tatsächlicher Viewport; Gerätetests erforderlich |
| Seitenansicht/Pagination/Druck | unvollständig | unverändert offen, keine falsche Seitenanzeige |
| Handschrift/Stiftdaten | nicht vorhanden | kein Attrappenbutton; benötigt versioniertes Vektorstrokemodell mit Druck/Koordinaten, Editier-/Radierlogik und Exportfallback |
| Aufgabenlisten | nur benannte Checklist-Style | keine behauptete interaktive Checkbox; benötigt Schema und Office-Mapping |
| PDF/Drucken, RTF/EPUB, Offline-Rechtschreibung mobil | offen | konkrete Grenzen unverändert dokumentiert |
| Individuelle Dokument-/Ordnerkennwörter, Biometrie | offen | bestehender AES-GCM/Argon2id-Tresor unverändert, keine kosmetischen Kennwortdialoge |

## Test- und Installationsplan

Browseraktionen prüfen echte Menübedienung, Auswahl → Unterstreichen → Undo, aktive Marks, Umbenennen, Lesen/Schreiben, verkleinerten Viewport und Tabletgröße. Screenshots dienen nur der Sichtprüfung; sie beweisen keine Gboard-/Stiftkompatibilität. Native API-35-Instrumentierung prüft weiter echte Touch-/Keyevents, A5-Layout, Verschlüsselung und Rücktransfer; der neue Menüpfad zur Sperre ist Teil des Tests. Mehrere Bildschirmtastaturen, Spracheingabe, echte Stifte und echte Tablets bleiben zusätzliche Gerätematrix, keine behauptete Freigabe.

APK aus Android-CI-Artefakt installieren. Vor einem Debug-Zertifikatswechsel verschlüsseltes Backup außerhalb der App sichern; keine ungesicherte Deinstallation der alten App. Kein Release/Play-Store-Publishing.

## Auslieferungsstand 0.5.0-alpha.3

Der Branch baut auf dem offenen Writer-A1-PR auf und muss in dieser Reihenfolge integriert werden. VersionCode 3 kennzeichnet die neue Android-Testausgabe. Die gemeinsame Dokument-/Tresorstruktur bleibt unverändert; vorhandene Dateien benötigen keine Migration.
