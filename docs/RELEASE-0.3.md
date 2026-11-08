# Writely 0.3.0-alpha.1 · Seitenlayout & Dokumentwerkzeuge

Erste Ausbaustufe der Dokument- und Layoutwerkzeuge. Der vollständige Layoutdesigner ist damit noch nicht abgeschlossen.

## Neu

- **Layout → Seite einrichten:** A3/A4/A5, Letter, Legal, Tabloid, Executive, eigene Maße; Hoch-/Querformat; Millimeter, Zentimeter, Zoll und Punkt. Individuelle oder gleiche Ränder, Bundsteg und gespiegelte Ränder.
- Abschnittsumbrüche für unterschiedliche Papierformate und Ausrichtungen innerhalb einer Datei. Einstellungen für Dokumentstandard, aktuellen oder neuen Abschnitt.
- Spaltenzahl und Abstand, Spaltentrennlinie, Hintergrundfarbe, Seitenrahmen, Textwasserzeichen und einfache Kopf-/Fußzeilen.
- Automatische Seitennummern im Kopf oder Fuß, arabisch/römisch/Buchstaben, Startwert, fortlaufende oder neu beginnende Abschnitte, erste Seite ohne Nummer und „Seite X von Y“.
- **Ansicht → Seitenbereiche:** manuelle Seiten-/Abschnittsbereiche auswählen, davor/danach einfügen, duplizieren, löschen und per Drag & Drop umordnen. Formatierter Inhalt und Abschnittslayouts bleiben erhalten. Undo/Redo für neue Dokumentaktionen.
- **Strg+P / Druckvorschau:** tatsächlich erzeugte PDF mit automatischer Pagination im nativen PDF-Betrachter. Miniaturen, Zoom, Speichern und Drucken mit Druckerauswahl/Skalierung. Gemischte Papiergrößen werden als echte unterschiedliche PDF-Seitenboxen ausgegeben.
- Erweiterte deutsche Menüs: Bearbeiten, Ansicht, Einfügen, Format, Tabelle, Layout, Verweise, Überprüfen, Hilfe. Neue Hauptaktionen in der Befehlspalette.
- Tabellenwahl mit bis zu 2.000 Zellen je Einfügevorgang. Zeilen/Spalten hinzufügen, löschen, bewegen und duplizieren; Zellen verbinden/trennen; Kopfzeile, Zellfarben, Rahmen und Abstände. Bewegungen zusammengeführter Zellen melden eine klare Einschränkung.
- Bilder aus Datei, nativer Zwischenablage oder Bildschirmaufnahme. Bilddialog für Breite, Beschnitt, 90°-Drehung, Spiegelung, Helligkeit, Kontrast, Rahmen, Alternativtext und einfachen Textumfluss. Das Original bleibt für spätere Bearbeitung erhalten.
- Einfache Formen, Prozess-/Listen-/Zyklus-/Hierarchie-/Vergleichs-/Zeitachsengrafiken und Balken-/Linien-/Kreis-/Flächen-/Punktdiagramme. Lokale Rasterbilder; Beschriftung, Farbe und Daten können über denselben Grafikdialog erneut geändert werden.
- Sonderzeichen, Typografiezeichen, Emojis und statisches Datum/Uhrzeit.

## Dateiformate

DOCX exportiert Abschnittsmaße, Ränder, Spalten, Kopf-/Fußzeilen, Seitenfelder, unterstützte Tabellenformatierung und Bilder. ODT erhält einen eigenen ODF-1.3-Schreiber mit Masterseiten, Grundstyles, Tabellen und Bildern. Externe DOCX-/ODT-Importe lesen grundlegende Abschnittslayouts zusätzlich zum semantischen Inhalt. Das ersetzt keine vollständige Word-/LibreOffice-Kompatibilität.

Unveränderte Writely-Exporte nach DOCX, ODT und EPUB enthalten zusätzliche Writely-Metadaten für den genauen Rückimport des eigenen Modells. Ein Paketfingerabdruck verhindert, dass nach externen Änderungen veralteter Inhalt wiederhergestellt wird; dann greift der normale, möglicherweise vereinfachende Import. Metadaten können die Dateigröße erhöhen. RTF bleibt ein grundlegender Pandoc-Import/-Export. EPUB bleibt umfließend, ohne feste Papierpagination. TXT/Markdown verlieren Layoutinformationen.

## Grenzen dieses Releases

Die Schreibansicht bleibt kontinuierlich. Seitenbereiche zeigen manuelle Grenzen und Textausschnitte, keine Miniaturen sämtlicher automatisch umbrochener Seiten. Unterschiedliche Abschnittsbreiten werden verbindlich in der PDF-Vorschau dargestellt. Ein Bereich kann mehrere Druckseiten umfassen. Einzelne Druckseiten können im PDF-Druckdialog ausgewählt werden; separater Export einzelner Editorbereiche ist offen.

Noch offen: echte Fuß-/Endnoten, dynamische Querverweise, Lesezeichen, automatische Abbildungs-/Tabellen-/Literaturverzeichnisse, Formeleditor, QR-/Barcodes, Freihand, frei positionierbare Vektorobjekte/Textboxen, Ebenen/Gruppen, Raster/Guides, ungleiche Spalten und Medienanhänge. Inhaltsverzeichnis und Beschriftungen bleiben Text und müssen nach Änderungen neu erzeugt werden. Formen/Diagramme sind Bilder, keine Office-SmartArt-/Chart-Objekte.

Komplexe externe Tabellen, schwebende Objekte, Rich-Text-Kopfzeilen, Noten, Kommentare und Änderungsverfolgung sind nicht verlustfrei zugesichert. PDF/A, PDF/UA, eine vollständige Word-/LibreOffice-/Reader-Abnahme und Leistungsnachweise für hunderte Seiten stehen aus. Bei zusammengefügten Abschnitts-PDFs werden Outline-Lesezeichen nicht zugesichert. PDF-Import/OCR und Stapelkonvertierung bleiben offen.

## Installation und Daten

Windows-Setup ausführen oder portables ZIP vollständig entpacken. Pandoc, Lizenz und korrespondierender Quellcode sind enthalten. Die App benötigt im Betrieb keinen Upload und kein Internet. Der Build ist eine unsignierte Vorabversion.

Bestehende Dokumente, Bibliothek, Auto-Save, Recovery, Versionen und Fenster-/Monitoreinstellungen bleiben im bisherigen lokalen App-Datenordner. Neue Layoutdaten erweitern das bestehende Modell additiv. Ältere Writely-Versionen verstehen neue Layoutknoten möglicherweise nicht; neue Dateien mit 0.3 oder neuer öffnen.

## Prüfung

Modell-/Konvertertests: Papiermaße, Validierung, Umbrüche, eigene/externe DOCX-/ODT-Abschnitte, Metadatenfingerabdruck, beschädigte Metadaten und bestehende Speicher-/Recovery-Funktionen. Browsertests: Layout-Undo/Redo, Seitenbereiche, Tabellenkopien, Bildbearbeitung und bestehende Editor-/Bibliotheksabläufe. Echter Desktoptest: DOCX, PDF, gemischte Seitengrößen und native Vorschau. Veröffentlichung erst nach erfolgreichem Windows-CI-Lauf des exakten Release-Commits; das Windows-Testprotokoll liegt als Release-Datei bei.

Vorherige Hinweise: [0.2.1 Fenster & Monitore](RELEASE-0.2.1.md), [0.2 Bibliothek & Gestaltung](RELEASE-0.2.md). [Technischer Stand und nächste Schritte](LAYOUT.md).
