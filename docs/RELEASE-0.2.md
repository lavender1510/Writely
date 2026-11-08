# Writely 0.2.0-alpha.1 · Bibliothek & Gestaltung

Dieses Update erweitert die lokale Windows-Schreibapp. Die folgenden Funktionen sind umgesetzt; die vollständige Produktspezifikation bleibt größer als dieser Vorabrelease.

## Neu

- Startbildschirm statt sofortigem Editor; eine vorhandene Recovery-Sitzung kann ausdrücklich fortgesetzt werden.
- Lokale Bibliothek mit Kacheln/Listen, Textvorschau, Änderungsdatum, Wortanzahl, Suche, Anheften und Sortierung nach Name, Zeit, Dateityp und Größe. Einträge werden in Gruppen von 60 angezeigt.
- Verschachtelte Ordner mit Farben, Erstellen, Umbenennen, Verschieben und Entfernen. Dokumente bleiben beim Entfernen eines Ordners erhalten. Dokumente lassen sich zuordnen, per Drag & Drop verschieben und duplizieren.
- 20 bearbeitbare Startvorlagen, eigene Dokumentvorlagen und lokal gespeicherte Vorlagensätze.
- Erweiterte benannte Styles, Style-Duplikate, Umbenennen und Entfernen mit Ersatz durch Normaltext; sieben Dokumentthemes.
- Coverdialog mit bearbeitbarem Titel, Untertitel, Autor, Datum, Akzentfarbe und lokalem Logo/Bild. Cover stehen am Anfang; DOCX, ODT und PDF berücksichtigen den Seitenwechsel.
- Lokaler Konverter mit Zielformat, Rändern und nativem Ausgabedialog. DOCX, PDF, HTML, Markdown, TXT sowie grundlegendes ODT, RTF und EPUB.
- Pandoc 3.13 ist im Windows-Paket enthalten. Konvertierung braucht keinen Upload. Lizenz und korrespondierender Pandoc-Quellcode liegen im Paket unter `tools/`.
- Einheitliches vorhandenes Projektlogo als Windows-ICO mit mehreren Größen, Fensterlogo, Installer-Logo und Verknüpfungen. Setup richtet eine Writely-Dateizuordnung ein; beim Start mit einer .writely-Datei wird diese geöffnet.

## Installation

Für die normale Windows-Installation die Datei `Writely-0.2.0-alpha.1-Setup-x64.exe` verwenden. Alternativ das portable Windows-ZIP vollständig entpacken und Writely.exe starten. Beide Builds sind unsignierte Vorabversionen.

Vorhandene .writely-Dateien bleiben lesbar. Die bisherigen Recovery- und Versionsdateien bleiben erhalten. Strg+S speichert die selbst gewählte Datei; die lokale Bibliothek und Wiederherstellung halten zusätzlich Arbeitsstände.

## Wichtige Grenzen

ODT/RTF/EPUB übertragen unterstützte semantische Inhalte. Das ist keine vollständige, originalgetreue Office-Kompatibilität: Kopf-/Fußzeilen, echte Fußnoten, Kommentare, Änderungsverfolgung, komplexe Tabellen und exakte Positionierung sind noch nicht vollständig im Editor modelliert. Importmeldungen weisen auf mögliche Verluste hin. Quelldateien werden beim Konvertieren nicht überschrieben.

PDF-Import, OCR und Stapelkonvertierung sind noch nicht verfügbar. Cover-Hintergrundbilder, frei positionierbare Coverelemente und beliebige Seitenhintergründe folgen später. EPUB ist umfließend und übernimmt keine feste Papierpagination. Die Coverfunktion ergänzt bearbeitbare Inhalte; sie bietet noch keinen vollständigen Layoutdesigner.

Die Bibliothek organisiert lokale Kopien/Arbeitsstände und Referenzen auf gewählte Dateien. Ordneraktionen verschieben keine ursprünglichen Explorer-Dateien. Bibliotheksindex und benutzerdefinierte Vorlagen liegen lokal als versionierbare JSON-Daten im App-Datenordner; eine SQLite-Suchdatenbank ist ein späterer Ausbau. Bibliothekseinträge können entfernt werden, ohne die Originaldatei zu löschen. Das erneute Öffnen über eine Dateizuordnung bei bereits laufender App ist noch eingeschränkt.

Die kleinen Vorschauen zeigen die ersten Textblöcke, keine exakte paginierte Druckvorschau. Gespeicherte Vorlagensätze besitzen noch keinen umfassenden Verwaltungsdialog. Einige Spezialstyles wie Fußnote und Checkliste sind Darstellungsregeln, keine eigene Noten- oder Aufgabenfunktion. Große Bibliotheken und lange Dokumente benötigen weitere Leistungsbenchmarks.

## Prüfung

Gezielte Tests decken Ordnerzyklen, rekursives Entfernen ohne Dokumentverlust, Bibliotheksaktualisierungen, Vorlagen, Themes, Cover, ODT-/RTF-/EPUB-Roundtrips sowie die bestehenden Dokument-/Recovery-Funktionen ab. Browserprüfungen testen neue Bibliotheks- und Coverabläufe zusätzlich zum bisherigen Editor. Der Windows-CI-Lauf prüft Build, Konverter und echte Desktop-Abläufe vor der Veröffentlichung.
