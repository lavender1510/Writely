# Layout-Update: Umsetzung und Entwicklungspfad

## Bedienkonzept

Thematische Menüs ergänzen das reduzierte Ribbon. „Layout“ enthält Seiteneinstellungen und Umbrüche; „Einfügen“ Bilder, Tabellen, Grafiken und Zeichen. Der Seitendialog gruppiert Papier/Einheiten, Ränder, Spalten/Gestaltung sowie Kopf-/Fußzeilen/Nummerierung. Der Gültigkeitsbereich wird ausdrücklich gewählt. Unbrauchbare Einstellungen ohne Textbereich werden abgelehnt.

Die optionale linke Seitenbereiche-Leiste ergänzt den Überschriftennavigator. Rechts bleibt die Textformatierung. Strg+Enter fügt einen Seitenumbruch ein, Strg+P öffnet die erzeugte PDF. Strg+K erschließt die wichtigsten neuen Aktionen. Dialogfelder und normale Schaltflächen sind per Tab erreichbar; Umordnen ist per Drag & Drop und über Auf-/Ab-Schaltflächen möglich. Eine vollständige Screenreader-/Tastaturabnahme steht aus.

## Dokumentmodell

Der versionierte JSON-Container bleibt bestehen. Papierdaten werden additiv erweitert:

```ts
type PageLayout = {
  size: 'A3'|'A4'|'A5'|'Letter'|'Legal'|'Tabloid'|'Executive'|'Custom';
  widthMm?: number; heightMm?: number;
  orientation?: 'portrait'|'landscape'; unit?: 'mm'|'cm'|'in'|'pt';
  marginMm: number; // Standardwert und bestehende Dateien
  margins?: {top:number;right:number;bottom:number;left:number};
  gutterMm?: number; mirrored?: boolean;
  columns?: number; columnGapMm?: number; columnRule?: boolean;
  background?: string; border?: boolean; watermark?: string;
  header?: string; footer?: string;
  numbering?: {enabled:boolean;start:number;restart?:boolean;
    position:'header'|'footer';format:'arabic'|'roman'|'letters';
    total:boolean;firstDifferent:boolean};
};
```

Maße werden in Millimetern normalisiert; Adapter rechnen nach Twips, ODF-Längen und PDF-Punkten um.

`layoutBreak` ist ein atomarer Block mit `kind: page|section|column`, ID und optionalem Abschnittslayout. Der Dokumentstandard steht in `document.page`; das synchronisierte Root-Attribut `content.attrs.pageLayout` nimmt Layoutänderungen in die ProseMirror-Historie auf. Ein Abschnittsumbruch beginnt ein neues Layout. `documentSections` zerlegt denselben Baum für die Adapter. Automatische Druckseiten sind abgeleitete Renderergebnisse, keine getrennten Textcontainer.

Tabellen bleiben strukturierte Tabellen-/Zeilen-/Zellknoten mit Spans, optionalen Breiten, Zellfarbe, Rahmen und Innenabstand. Bilder speichern lokale Data-URIs, Alternativtext, Maße, einfachen Umfluss, optionales Original und Bearbeitungsparameter. Grafiken enthalten zusätzlich Typ, Text, Farbe und Daten. Speicher-, Recovery- und Versionswege bleiben gemeinsam.

## Technische Aufteilung

- `electron/layout.mjs`: Normalisieren, Validieren, Abschnitte, Zahlenformate und Tabellenbreiten.
- `src/layout-editor.ts`: Layoutmetadaten/Umbruchknoten im Tiptap-Schema. `LayoutPanel`, `PageNavigator`, `TableTools`, `ImageTools`, `InsertPanel` kapseln die Bedienung; Änderungen laufen als Editortransaktionen durch Undo/Redo.
- `electron/print-layout.cjs`: CSS-Geometrie, Abschnittsrendering und PDF-Zusammenführung mit pdf-lib. Chromium wartet auf lokale Fonts und Bilddecodierung. Der native PDF-Betrachter zeigt denselben Ausgabeweg.
- `electron/formats.cjs`: OOXML-Export. `odt.cjs`: ODF-Schreiber. `docx-layout.cjs`/`odt-layout.cjs`: grundlegende externe Seiteneinstellungen durch den semantischen Import erhalten.
- `electron/roundtrip.cjs`: validierte zusätzliche Writely-Struktur mit SHA-256-Paketfingerabdruck. Externe Änderungen/fehlerhafte Metadaten führen zum normalen Import des sichtbaren Inhalts.
- Hauptprozess/Preload: begrenzte IPC für Vorschau, Bildzwischenablage und Bildschirmaufnahme. PDF-Renderer/Vorschau haben isolierte Sitzungen mit beschränkten Ressourcen. Screenshot-Auswahl erfolgt nativ; importierte Dokumente können keine Aufnahme auslösen.

Beim Tippen wird nicht neu paginiert. Seitenbereiche werden bei sichtbarer Leiste anhand des Dokumentbaums zwischengespeichert. Bildrendering/PDF-Erzeugung laufen beim Anwenden bzw. Exportieren. Belastbare Langdokument-Benchmarks bleiben eine eigene Abnahmeaufgabe.

## Prioritäten und nächste Schritte

| Priorität | Schritt | Stand / Abnahme |
| --- | --- | --- |
| P0 | Papier, Ränder, Umbrüche, Abschnitte, Undo, Speicherwege | In 0.3; Validierungs-/Recovery-/Historytests |
| P0 | DOCX/ODT-Geometrie, gemischte PDF-Seiten, Vorschau | In 0.3; XML-/Import-/Desktoptests; visuelle externe Office-Abnahme ausbauen |
| P1 | Tabellen-/Bildwerkzeuge, einfache Grafiken | In 0.3; Browseraktionen und Exportgrundlagen; Bewegung verbundener Zellen begrenzt |
| P1 | Automatisch paginierter Editor und echte Seitenminiaturen | Offen: inkrementelles Layout, Textposition-zu-Seite-Mapping, Virtualisierung, Hundertseiten-Benchmark |
| P1 | Noten, Lesezeichen, Felder, automatische Verzeichnisse | Offen: semantische IDs/Knoten, Referenzauflösung, Nummerierung, Adapter und Undo-Tests |
| P2 | Freie Vektorobjekte, Formeln, Guides, Ebenen/Gruppen | Offen: getrennte Objekt-/Ankerstruktur und Transformationen; Bearbeitungs-/Exporttests |
| P2 | Vollständiger Kompatibilitätskorpus und Druckabnahme | Offen: Word/LibreOffice/EPUBCheck, Screenshotvergleiche, große Tabellen, lange Noten, gemischte Abschnitte |

Nächster Ausbau: P1-Pagination und Referenzen getrennt liefern, danach freie Objekte. Bestehende Versionen, Ordner und Fensterpräferenzen behalten ihren Speicherpfad.
