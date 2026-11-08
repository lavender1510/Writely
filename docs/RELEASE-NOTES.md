# Writely v0.1.0-alpha.1

Erste lokale Desktop-Vorabversion, 8. November 2026. Ziel dieser Version: schreiben, strukturieren, sicher als Writely-Datei ablegen und einfache Dokumente weitergeben. Die vollständige Produktspezifikation ist eine Roadmap; der hier beschriebene Umfang ist deutlich kleiner.

## Enthalten

- Deutsche Desktop-Oberfläche mit reduziertem Ribbon, Navigator, Formatierungs-Sidebar, Statusleiste und Befehlspalette.
- Tiptap-Rich-Text-Editor mit Undo/Redo, Überschriften 1–6, Listen, Tabellen, Bildern, Links, Zitaten und Codeblöcken.
- Grundlegende Zeichen-/Absatzformatierung und gemeinsam bearbeitbare benannte Stilregeln einschließlich einfacher Vererbung.
- Fortlaufende Dokumentfläche mit A4-/Letter-Einstellung und Rändern für die Ausgabe.
- Helles/dunkles Design, Fokusmodus, Typewriter-Scrolling, Zoom, Statistiken und vier inhaltliche Startvorlagen neben leerem Dokument und Willkommensbeispiel.
- Suche/Ersetzen, optional mit JavaScript-RegEx innerhalb einzelner Textruns.
- Versioniertes `.writely`-JSON, atomisches Dateischreiben, debouncete lokale Wiederherstellung, vorheriger Recovery-Stand und einfache lokale Snapshot-Historie.
- DOCX-/Text-/Markdown-/HTML-Import und entsprechende Exporte; PDF-Erzeugung im Desktop über Chromium.
- Desktop-Systemfont-Ermittlung sowie lokal gebündelte Inter und Source Serif 4 unter SIL OFL 1.1.
- Abgeschotteter Renderer mit Capability-Bridge, gesperrten fremden Netzwerkanfragen und bereinigtem Dokument-HTML.

## Download und Start

`Writely-0.1.0-alpha.1-Windows-x64.zip` vollständig entpacken und im entpackten Ordner `Writely.exe` starten. Alle mitgelieferten Ressourcen im selben Verzeichnisverbund belassen. Das portable ZIP enthält keinen Installer und ist nicht signiert. Node.js ist für die fertige App nicht erforderlich.

Die beigefügten SHA-256-Prüfsummen dienen dem Vergleich des Downloads mit dem veröffentlichten Artefakt. Sie ersetzen keine Codesignatur.

## Datensicherheit und lokale Daten

Auto-Sicherung ist ein lokaler Wiederherstellungsstand, kein automatisches Überschreiben der gewählten Dokumentdatei. Eigene Dateien mit `Strg+S` sichern. Die App hält maximal 30 Versionssnapshots insgesamt; automatische Snapshots entstehen ungefähr im Minutenabstand pro aktivem Dokument, manuelles Speichern legt ebenfalls einen Snapshot an. Dokumente mit eingebetteten Bildern können die Dateien und Historie deutlich vergrößern.

Die Vorabversion begrenzt Desktop-Eingabedateien auf 64 MiB, eingefügte einzelne Bilder auf 10 MiB und die verschachtelte Dokumentstruktur. DOCX-Pakete besitzen zusätzliche Prüfgrenzen für ZIP-Einträge und entpackte Größe. Größere oder nicht unterstützte Dateien werden mit deutscher Meldung abgewiesen.

## Formatgrenzen

DOCX erhält unterstützte Text-, Absatz-, Listen-, Tabellen- und Bildstrukturen grundlegend. Komplexe Layouts können sich ändern. Kopf-/Fußzeilen, Kommentare, Fußnoten und Änderungsverfolgung werden nicht vollständig übernommen; beim Import erscheint ein Kompatibilitätshinweis. DOCX-Schriften werden als Familiennamen referenziert, nicht als Fontdateien eingebettet. WEBP-Bilder können im Editor genutzt werden, benötigen für DOCX aber PNG/JPEG oder eine andere Ausgabe.

PDF erzeugt echte Seiten im gewählten Format. Die Editoransicht selbst ist noch keine paginierte Druckvorschau. Schrifteinbettung hängt von Renderer, Schrift und Einbettungsrechten ab; PDF/A, PDF/UA, CMYK und kontrollierte Metadaten sind nicht Teil dieser Version. Der Chromium-Auftrag fordert eine Dokumentgliederung an; die Qualität von PDF-Lesezeichen ist noch nicht mit beliebigen Dokumenten validiert.

Markdown und HTML bilden nur die unterstützte Dokumentstruktur ab. Das Inhaltsverzeichnis ist statisch. Weitere Details und geplante Adapter: [FORMATE.md](FORMATE.md).

## Noch nicht enthalten

ODT, RTF, EPUB, DOC, PDF-Import/OCR; echte Fuß-/Endnoten; dynamische Inhalts-/Abbildungs-/Tabellenverzeichnisse; umfassende Referenzen und Seitenabschnitte; Kopf-/Fußzeilen; Multi-Cursor und rechteckige Auswahl; Kommentare und Änderungsverfolgung; Fontimport; paketierte Offline-Rechtschreibprüfung Deutsch/Englisch samt Benutzerwörterbuch/Thesaurus/Silbentrennung; Cloud, Kollaboration und Mobile Apps.

Ein vollständiger Office-Roundtrip, eine geprüfte Screenreader-Konformität, Start unter zwei Sekunden und stabiles Arbeiten mit hunderten komplexen Seiten werden noch nicht zugesichert. Helles und dunkles Design sind vorhanden; automatisches Folgen des Systemdesigns ist noch kein eigener Modus.

## Prüfstatus

Das Projekt enthält Tests für Dokumentfunktionen, Formatkonvertierung, Speicherung/Recovery und PDF-Schriftregeln sowie Playwright-Prüfungen der sichtbaren Editorabläufe. Entwicklung und ausführbare Desktopprüfungen erfolgen zunächst unter Linux; die Windows-Paketierung ist gesondert vorgesehen. Maßgeblich für bestandene Prüfungen sind die im GitHub-Release bzw. zugehörigen CI-Lauf veröffentlichten Resultate.

Ein interaktiver Windows-10/11-Test, Referenzvergleiche in Microsoft Word/LibreOffice sowie Start- und Langdokument-Benchmarks stehen noch aus. Ein generiertes Windows-ZIP ist kein Nachweis für diese offenen Prüfungen.

## Als Nächstes

Windows-Tests und Speicherung härten, Formatkorpus ausbauen, echte Fußnoten und Seitengliederung planen sowie ODT-/RTF-/EPUB-Adapter, lokale Wörterbücher und Fontverwaltung ergänzen. Der vollständige Umsetzungsplan steht in [KONZEPT.md](KONZEPT.md).
