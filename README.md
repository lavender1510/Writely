# Writely

Eine lokale Schreibapp mit deutscher Windows-Oberfläche. **0.2.0-alpha.1** bringt einen Startbildschirm, Dokumentenbibliothek, Ordner, mehr Vorlagen, Themes, Cover und lokale Formatkonvertierung.

![Writely Startbildschirm](docs/images/startbildschirm.png)

## Download

Im [GitHub-Release](https://github.com/lavender1510/Writely/releases) das Windows-Setup ausführen oder das portable ZIP vollständig entpacken und Writely.exe starten. Node.js und Internet sind für die installierte App nicht erforderlich. Die Vorabversion ist nicht signiert.

## Funktionen

Rich Text mit Überschriften, Listen, Tabellen, Bildern und Links; globale Styles; Fokus-/Darkmodus; Befehlspalette; Suchen/Ersetzen; Auto-Save/Recovery und lokale Versionen. Dazu Bibliothek mit Ordnern, Suche, Anheften, Vorlagen, Cover und Themes.

Import/Export: .writely, DOCX, Text, Markdown, HTML und grundlegendes ODT/RTF/EPUB. PDF-Export über Chromium. Pandoc ist im Windows-Paket samt Lizenz und korrespondierendem Quellcode enthalten. Konvertierung erfolgt lokal.

**Strg+S aktualisiert die gewählte Datei.** Automatische Wiederherstellung und Bibliothek sind zusätzliche lokale Sicherungen.

## Grenzen und Planung

[Release-Hinweise](docs/RELEASE-NOTES.md) beschreiben den tatsächlichen Umfang. Vollständige Office-Treue, PDF-Import/OCR, echte Fußnoten/Kommentare, Offline-Rechtschreibwörterbücher und Echtzeit-Kollaboration sind weitere Ausbaustufen. [Produktkonzept und Architektur](docs/KONZEPT.md), [Formatplanung](docs/FORMATE.md).

## Entwicklung

Node 24 und npm. `npm ci`, `npm run build`, `npm run desktop`. Browser-Vorschau: `npm run dev`.

Prüfungen: `npm test`, `npm run test:e2e`, `npm run test:desktop`. Konvertertests brauchen Pandoc 3.13 als `WRITELY_PANDOC` oder unter `.tools/pandoc`; Windows-CI richtet die gebündelte Version mit `node scripts/prepare-pandoc.cjs` ein.

[Drittanbieterhinweise](THIRD_PARTY_NOTICES.md). Für Writely-eigenen Code ist noch keine gesonderte Open-Source-Lizenz festgelegt.
