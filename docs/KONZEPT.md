# Writely – Produkt- und Umsetzungskonzept

Stand: 8. November 2026. Dieses Dokument beschreibt das Produktziel und die schrittweise Umsetzung. Es ist keine Zusicherung, dass alle beschriebenen Funktionen bereits in der Vorabversion enthalten sind. Der tatsächliche Funktionsumfang steht in den Release-Hinweisen; Formatgrenzen stehen in [FORMATE.md](FORMATE.md).

## 1. Produktvision

Writely ist eine ruhige, schnelle Schreibumgebung für Windows 10 und 11. Dokumente gehören den Schreibenden, werden lokal gespeichert und lassen sich ohne Konto und ohne Internet bearbeiten. Die Oberfläche zeigt die täglich benötigten Werkzeuge direkt und organisiert komplexe Funktionen in einer kontextbezogenen Seitenleiste und einer Befehlspalette.

Die violette Markenwelt des bereitgestellten Writely-Logos setzt Akzente; das Dokument bleibt im Mittelpunkt. Eine gelungene Sitzung bedeutet: App öffnen, weiterschreiben, sicher speichern und das Ergebnis zuverlässig weitergeben.

Die Zielgruppen sind Studierende, Berufstätige und Autorinnen und Autoren. Der erste Schwerpunkt liegt auf Briefen, Berichten und Manuskripten. Komplexer wissenschaftlicher Satz, beliebige Word-Dokumente und gemeinsame Bearbeitung werden schrittweise erschlossen.

Leitlinien:

- Lokal zuerst: keine Pflichtanmeldung, keine notwendige Netzwerkverbindung, keine eingebauten Online-Schriften.
- Schreibfluss zuerst: Textänderungen laufen unmittelbar im Editor; Konvertierung, Statistik und Persistenz dürfen die Eingabe nicht blockieren.
- Dokumenttreue sichtbar machen: Konverter melden konkret, welche Elemente vereinfacht oder ausgelassen wurden.
- Offen speichern: versioniertes, dokumentiertes Writely-Format und austauschbare Import-/Exportadapter.
- Barrierefreiheit von Anfang an: beschriftete Bedienelemente, sichtbarer Tastaturfokus, Kontraste und skalierbare Oberflächen.

## 2. Roadmap und Abnahmekriterien

### MVP / v0.1 – erste nutzbare Vorabversion

Ziel: Ein einzelnes lokales Dokument schreiben, formatieren, öffnen, speichern, nach einem Absturz wiederfinden und als DOCX oder PDF weitergeben.

Umfang:

- Windows-Desktop-Hülle mit deutschem React-Editor, heller/dunkler Darstellung und Fokusmodus.
- Rich Text mit Überschriften, Fett/Kursiv/Unterstrichen, Listen, einfachen Tabellen, Bildern, Links und Undo/Redo.
- Bearbeitbare benannte Darstellungsregeln für Normaltext, Überschrift 1/2 und Zitat; globale Darstellung im Dokument über zugehörige CSS-Regeln. Das vollständige Stilmodell mit Vererbung und Zeichen-/Tabellenstyles folgt später.
- Navigator aus Überschriften, Wort-/Zeichenstatistik, einfache Suche und Befehlspalette.
- Versioniertes `.writely`-JSON; Text-, Markdown- und HTML-Import/-Export; grundlegender DOCX-Import/-Export; PDF-Export im Desktop-Build.
- Lokale Wiederherstellung und sichtbarer Speicherstatus; explizites Speichern über einen nativen Dateidialog.
- Windows-Paket und reproduzierbare CI; vollständige Liste der bekannten Einschränkungen.

Abnahme:

1. Neues Dokument → formatieren → speichern → schließen → öffnen erhält die unterstützten Inhalte.
2. Nach einem simulierten Prozessabbruch wird der zuletzt tatsächlich persistierte Stand angeboten. Wiederherstellung und manuell gespeicherte Datei sind unterscheidbar.
3. Undo/Redo stellt Text, unterstützte Formatierung und Tabellenaktionen wieder her.
4. Eine DOCX-Beispieldatei mit Absätzen, Überschriften und einfachen Formatierungen wird exportiert und wieder geöffnet. Abweichungen sind dokumentiert.
5. Der Windows-Desktop-Build erzeugt eine lesbare PDF mit überprüften Umlauten, Seitenumbrüchen und lokalen Bildern.
6. Die gepackte Anwendung startet ohne laufenden Entwicklungsserver und arbeitet nach Installation ohne Netzwerk.
7. Windows-Installer bzw. portables Paket wird auf Windows getestet. Ein auf Linux erzeugtes Paket allein belegt noch keinen erfolgreichen Windows-Start.

### Version 1.0 – verlässlicher Alltagseditor

Zusätzlich:

- Echte Absatz-/Zeichenformatvorlagen mit zentraler Aktualisierung, Vererbung und klarer Priorität gegenüber direkter Formatierung.
- Tabellenbearbeitung, Bildgrößen und Bildunterschriften, Fußnoten, automatisches Inhaltsverzeichnis und Abschnitts-/Seiteneinstellungen.
- Schriftartenerkennung, Vorschau, Import erlaubter Schriftdateien und nachvollziehbarer Font-Fallback.
- Offline-Rechtschreibprüfung Deutsch/Englisch mit paketierten Wörterbüchern, Benutzerwörterbuch und AutoKorrektur; Thesaurus und Silbentrennung gesondert abnehmen.
- Suche/Ersetzen einschließlich sicher begrenzter regulärer Ausdrücke.
- ODT-, RTF- und EPUB-Konverter mit veröffentlichter Kompatibilitätsmatrix.
- Lokale Versionshistorie mit Wiederherstellung ohne Überschreiben des aktuellen Standes.
- Zugänglichkeit mit Windows-Narrator sowie vollständige Tastaturbedienung der Hauptabläufe.
- Vorlagen für Brief, Lebenslauf, Hausarbeit, Bericht, Protokoll, Rechnung, Drehbuch, Blogartikel und Roman.

Abnahme: definierter Dokumentkorpus mit Tabellen, Bildern, Schriften und Fußnoten; automatische Strukturprüfungen, visuelle Vergleiche und Öffnung in Word/LibreOffice. „ODT vollständig“ und „DOCX originalgetreu“ werden nur für geprüfte Funktionen behauptet. Eine lückenlose Abdeckung beliebiger Office-Dateien ist kein realistisches pauschales Release-Versprechen.

### Version 1.x – umfangreiche Dokumente und redaktionelle Arbeit

Kommentare und Antworten, stabile Textanker, Änderungsverfolgung mit Autor/Zeit/Farbe, Annehmen/Ablehnen und Dokumentvergleich. Ausbau von Kopf-/Fußzeilen, Verzeichnissen, Querverweisen, Endnoten, Wasserzeichen und anspruchsvollen Seiteneinstellungen. Multi-Cursor und Spaltenauswahl erst nach einem eigenen Interaktionsprototyp: In proportional gesetztem, umbrochenem Rich Text ist eine rechteckige Auswahl nicht gleichbedeutend mit der Spaltenauswahl eines Codeeditors.

### Spätere Versionen

Ordnerübergreifende Suche, optionale verschlüsselte Synchronisation, Berechtigungen und Echtzeit-Kollaboration. Danach Mobile Apps, OCR, KI, Makros und exotische Dateiformate. Ein Cloud-Dienst bleibt optional; das lokale Format bleibt unabhängig nutzbar.

## 3. Technische Architektur und Windows-Stack

### Entscheidung für die Vorabversion

**Electron + React + TypeScript + Tiptap/ProseMirror** ist der empfohlene erste Stack. Electron liefert native Dateidialoge, eine kontrollierte Chromium-Version und PDF-Ausgabe. ProseMirror bringt ein strukturiertes Dokument, Transaktionen, Selektionen und Undo/Redo mit. React rendert die App-Oberfläche; Texteingaben sollen keinen Neuaufbau des gesamten Dokuments durch React auslösen.

Diese Entscheidung priorisiert eine überprüfbare erste Version. Sie bedeutet einen höheren Speicher- und Paketbedarf als eine native Hülle. Start unter zwei Sekunden ist ein zu messendes Ziel, keine Eigenschaft, die sich allein aus der Bibliothekswahl ergibt.

| Alternative | Stärke | Konsequenz |
| --- | --- | --- |
| Electron, React, Tiptap | Einheitlicher Renderer, PDF-API, gut auf Linux entwickelbar und auf Windows paketierbar | Größeres Paket, Chromium-Sicherheitsupdates und RAM-Budget einplanen |
| Tauri 2, React, Rust | Kleine native Hülle, direkte Betriebssystemanbindung | WebView2-, PDF-, Schrift- und Wörterbuchintegration vorher praktisch nachweisen |
| .NET/WPF oder WinUI 3 | Sehr gute Windows-Integration und UI-Automation | Leistungsfähiger eigener paginierter Editor und Formatkonverter bleiben große Eigenentwicklungen |

Ein späterer Wechsel zu Tauri wird erst nach Benchmarks und einem kleinen funktionalen Prototyp beschlossen. Die Dokument- und Konvertierungsschnittstellen dürfen deshalb nicht von Electron abhängen.

### Schichten

```text
React-Oberfläche: Ribbon, Navigator, Sidebar, Dialoge, Status
                         │ Befehle / Selektionszustand
Editoradapter: Tiptap / ProseMirror, Transaktionen, Eingabe
                         │ Dokument-Snapshot / Operationen
Dokumentkern: Schema, IDs, Styles, Validierung, Migrationen
             │                     │                     │
Lokale Persistenz           Formatadapter          Hintergrunddienste
Dateien, Recovery,          DOCX, ODT, PDF,         Statistik, Suche,
Versionen, Assets           HTML, MD, RTF, EPUB     Wörterbücher, Layout
             │                     │                     │
              Sichere, typisierte Desktop-Bridge
                  Electron Main / Betriebssystem
```

Module mit klaren Verträgen: `DocumentService`, `EditorAdapter`, `StorageService`, `ConversionService`, `FontService`, `ProofingService`, später `SyncService`. Konverter liefern stets ein Dokument plus strukturierte Warnungen. Der Dokumentkern enthält weder React-Komponenten noch Dateidialoge.

### Sicherheit und Offline-Betrieb

Der Renderer erhält keine freie Node-API. `contextIsolation` und Renderer-Sandbox bleiben aktiv, `nodeIntegration` bleibt aus. Eine kleine Preload-Bridge erlaubt nur ausdrücklich benannte Aktionen mit validierten Parametern. Importierte Inhalte werden als Daten behandelt; Skripte, Eventhandler, aktive HTML-Inhalte und externe Ressourcennachladungen sind zu entfernen oder zu blockieren. Bilder aus dem Web dürfen den Offline-Modus nicht stillschweigend durchbrechen. Externe Links werden ausschließlich nach ausdrücklicher Nutzeraktion im Systembrowser geöffnet.

ZIP-basierte Formate benötigen Limits für Dateigröße, Anzahl entpackter Dateien, Gesamtgröße, Bildabmessungen und XML-Tiefe; Pfade wie `../` dürfen niemals aus dem Zielordner entpackt werden. Keine externen XML-Entitäten. Konvertierungen laufen isoliert mit Zeit- und Speichergrenzen. Absturzberichte und Telemetrie bleiben standardmäßig aus, solange kein klarer Opt-in implementiert ist.

### Speicherung und Wiederherstellung

MVP: versioniertes JSON, lokale Wiederherstellung, native Dateidialoge und atomisches Speichern über eine temporäre Datei im Zielverzeichnis mit anschließendem Ersetzen. Recovery-Einträge erhalten Dokument-ID, Zeitpunkt und Bezug zur gespeicherten Datei. Fehler beim Schreiben müssen sichtbar sein; „gespeichert“ darf erst nach erfolgreicher Persistenz erscheinen. Linux-Desktop-Tests und Windows-CI ergänzen einander; ein erfolgreicher Windows-Build ersetzt keinen interaktiven Start-/Eingabetest unter Windows.

Ziel: operationelles Journal plus periodische Snapshots in einer lokalen SQLite-Datenbank mit WAL; Assets separat über ihren Hash. Speichern einer Datei und Recovery haben getrennte Lebenszyklen. Eine Version ist ein unveränderlicher Snapshot oder ein Snapshot mit zugehörigen Operationen. Bei geöffneten Dokumenten mehrerer App-Fenster verhindert ein Änderungs-/Dateistempel stilles Überschreiben. Aufbewahrungsgrenzen und „lokale Daten löschen“ werden bedienbar.

### Leistung als überprüfbares Budget

Referenz: dokumentierte Windows-11-Maschine mit SSD, CPU und RAM; getrennte Messung von Kaltstart, Warmstart und großem Dokument. Ziel: Start bis zum editierbaren leeren Dokument unter zwei Sekunden; Eingabe-/Darstellungszeit im 95. Perzentil unter 16 ms bei normalem Dokument und unter 50 ms im großen Korpus. Diese Werte sind Zielbudgets, bis Messprotokolle vorliegen.

Korpus: 10, 100 und 500 Seiten; Varianten mit vielen Bildern, Tabellen und Fußnoten. Lange Tasks, Speicherverbrauch, Suchzeit, Speicherdauer und PDF-Laufzeit messen. Statistiken inkrementell oder verzögert berechnen, Layoutarbeit bündeln und große Bilder verkleinern. Echte Pagination und Virtualisierung dürfen IME-Eingabe, Auswahl, Screenreader und Suchen nicht beschädigen. Ein einzelner großer `contenteditable`-Baum ist keine Garantie für flüssige 500-Seiten-Dokumente.

## 4. UI-Konzept

### Hauptfenster

- Titelleiste: Writely, Dokumentname, eindeutiger Speicherzustand, Undo/Redo und Windows-Fenstersteuerung.
- Reduziertes Ribbon: Datei, Start, Einfügen, Layout und Ansicht. „Start“ zeigt Absatzvorlage, Schriftfamilie/-größe, grundlegende Zeichen- und Absatzformatierung.
- Navigator links: Überschriften als anklickbarer Baum; später Bilder, Tabellen, Kommentare und Lesezeichen. Einklappbar und mit Tastatur erreichbar.
- Editor mittig: ruhiger Hintergrund, helle Dokumentfläche und gut lesbare Textbreite. Seitenansicht und tatsächliche Druckpagination werden erst dann gleichgesetzt, wenn das Layoutsystem sie korrekt berechnet.
- Kontextleiste rechts: Formatvorlagen, Absatz-/Seiteneinstellungen, später Kommentare und Versionsstände. Fortgeschrittene Einstellungen erscheinen hier statt als dauerhaft gefülltes Ribbon.
- Statusleiste: Wörter, Zeichen, Sprache, Speicherstatus und Zoom; später exakte Seitenzahl. Geschätzte Seitenzahlen müssen als Schätzung bezeichnet werden.

### Befehlspalette und Fokusmodus

`Strg+K` öffnet eine durchsuchbare Befehlspalette mit Namen und Tastenkürzeln. Eine Auswahl führt denselben Befehl aus wie Ribbon und Menü. Der Fokus kehrt danach in die vorherige Textauswahl zurück. Fokusmodus blendet Werkzeugbereiche aus; `Esc` stellt sie wieder her. Typewriter-Scrolling hält den aktiven Absatz in einer einstellbaren vertikalen Zone und muss Bewegungsreduktion beachten.

### Deutsche Oberfläche und Zugänglichkeit

Deutsche Beschriftungen und Fehlermeldungen sind Standard. Englisch wird über austauschbare Sprachressourcen ergänzt. Fehler nennen Ursache und Handlung, etwa: „Die Datei konnte nicht gespeichert werden. Der Ordner ist schreibgeschützt. Wähle einen anderen Speicherort.“ Kein reiner Farbcode für Status, keine ungekennzeichneten Symbolschaltflächen. Dialoge halten den Fokus; Schließen stellt ihn wieder her. UI-Skalierung, hohe Kontraste und Narrator werden als echte Testfälle behandelt.

## 5. Datenmodell

### Grundentscheidung

In v0.1 bleibt Tiptap-/ProseMirror-JSON der strukturierte Inhalt des versionierten Writely-JSON. Es werden nur die tatsächlich implementierten Knotentypen gespeichert. Der aktuelle Dateiumschlag lautet:

```ts
interface WritelyDocumentV1 {
  schemaVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  content: JSONContent; // Tiptap-/ProseMirror-Dokument
  styles: Record<string, StyleDefinition>;
  page: { size: 'A4' | 'Letter'; marginMm: number };
  fonts: FontReference[];
}

interface StyleDefinition {
  name: string;
  basedOn?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  lineHeight?: number;
}

interface FontReference {
  family: string;
  source?: string;
  fallback?: string;
}
```

Ein vorhandenes `basedOn`-Feld bedeutet noch keine vollständige Stil-Vererbungsengine. Benannte Stilregeln aktualisieren im MVP die zugehörigen Dokumentelemente global; direkte Zeichenformatierung bleibt vorrangig. Das Zielmodell ergänzt stabile IDs, getrennte Geschichten und dokumentweite Ressourcen; es wird durch explizite Migrationen eingeführt, nicht durch stillschweigende Schemaänderungen.

| Entität | Wesentliche Felder / Verhalten |
| --- | --- |
| Dokument | `schemaVersion`, `id`, Titel, Sprache, Erstell-/Änderungszeit, Metadaten, Abschnitte, Ressourcenreferenzen |
| Abschnitt | Stabile ID, Seitenformat in typografischen Punkten, Ränder, Spalten, Kopf-/Fußzeilenreferenzen, eigener Seitenzahlenbeginn |
| Absatz | Stabile ID, `styleId`, direkte Absatzattribute, Liste, Text-/Inlineknoten; Überschriften sind Absätze mit semantischer Ebene |
| Text-Run | Unicode-Text, Zeichenstil, direkte Zeichenattribute wie Gewicht/Farbe; Textpositionen berücksichtigen UTF-16 und Graphemgrenzen |
| Inlineknoten | Link, Fußnotenreferenz, Querverweis, Feld, Lesezeichen-/Kommentaranker; externe URL und interne Ziel-ID unterscheiden |
| Style | Stabile ID, Typ Absatz/Zeichen/Tabelle, Name, `basedOn`, Attribute und Folgevorlage; Vererbung zyklusfrei validieren |
| Bild | Ressourcen-ID, MIME-Typ, Hash, intrinsische/angezeigte Größe, Alternativtext, Bildunterschrift und Verankerung |
| Tabelle | ID, Zeilen, Zellen, Rasterbreiten, Rahmen, Abstände; `rowSpan`/`colSpan`, Zellen enthalten eigene Blockfolgen |
| Fuß-/Endnote | ID, Referenz im Text, eigener Blockinhalt, Nummerierungsregel; keine bloße hochgestellte Textzahl |
| Kommentar | ID, Autor, Zeit, Inhalt, Antworten, Zustand, stabile Anfangs-/Endanker; Anker durch jede Texttransaktion abbilden |
| Änderung | ID, Autor, Zeit, Einfügen/Löschen/Formatänderung; alter/neuer Inhalt und Anker, getrennt von Undo-Historie |
| Version | ID, Dokument-ID, Vorgänger, Zeit, Snapshot-/Journalreferenz, Prüfsumme und optionaler Name |
| Font | Logische Familie, PostScript-Name, Stil, Gewicht, Variable-Font-Achsen, Quelle, Lizenz und Einbettungsrechte |

Ziel für die vollständige Style-Auflösung: Dokumentstandard → Basiskette → zugewiesener Style → direkte Formatierung. Eine Stiländerung invalidiert nur betroffene berechnete Styles und aktualisiert alle zugehörigen Elemente. Die globale Anwendung benannter CSS-Regeln im MVP ist dafür ein begrenzter erster Schritt; sie ersetzt keine semantischen Zeichen-/Tabellenstyles und keine geprüfte Vererbung.

Kommentare und Änderungen werden über stabile Knoten-IDs plus auf Transaktionen abgebildete Positionen verankert. Für spätere CRDT-Synchronisation wird die Editorintegration gesondert bewertet; ein lokales Undo-Protokoll ist kein konfliktfrei synchronisierbares Datenmodell.

### Offenes Writely-Format

v0.1: UTF-8-JSON mit Versionskennung und eingebetteten, unterstützten Inhalten. Ein späteres Containerformat kann ein ZIP mit `manifest.json`, `document.json`, `styles.json` und `assets/<sha256>` verwenden. Dateiendung, Formatkennung und Migration bleiben eindeutig; zukünftige Pakete werden nicht unter der Annahme gelesen, sie seien altes JSON. Makros und ausführbarer Inhalt sind nicht Teil des Formats.

### Schriftarten

Windows-Systemschriften werden künftig über einen nativen Dienst, etwa DirectWrite, ermittelt; bloßes Auflisten bekannter Familiennamen beweist keine Installation. Das Dropdown bietet eine Vorschau der lokal verfügbaren Familie. Arial, Calibri, Cambria, Consolas, Georgia, Segoe UI, Times New Roman, Verdana, Tahoma, Trebuchet MS, Courier New, Impact und Wingdings werden genutzt, wenn installiert; ihre Dateien werden nicht mitgeliefert. Wingdings erfordert besondere Symbol-/Zeichenbehandlung.

Geeignete paketierbare Alternativen sind beispielsweise Noto Sans/Noto Serif, Carlito, Caladea und Liberation-Familien sowie nach geprüfter Lizenz Inter oder andere gewünschte Open-Source-Familien. Für jede tatsächlich gebündelte Fontdatei werden Herkunft, genaue Lizenz und Lizenztext mitgeliefert. Der Name eines Herstellers oder die Verfügbarkeit bei Google Fonts ersetzt keine Prüfung der konkreten Datei.

Fallbacks sind semantisch: fehlende Calibri → Carlito, Cambria → Caladea, Arial → Liberation Sans, Times New Roman → Liberation Serif, Consolas → geeignete Monospace-Familie; sie gelten nur, wenn die jeweilige Alternative installiert oder lizenziert mitgeliefert ist. Sonst folgt ein generischer Systemfallback. Änderungen am Zeilen-/Seitenumbruch werden dezent gemeldet. Proprietäre Fontdateien werden weder heruntergeladen noch ohne Recht eingebettet.

TTF/OTF und Variable Fonts benötigen gültige Metadaten; WOFF2 kann im Renderer genutzt werden, ist aber nicht automatisch eine systemweit installierbare Schrift. Import erfolgt in eine App-Sammlung und verändert nicht ohne gesonderte Aktion die Windows-Installation. PDF-Einbettung berücksichtigt Lizenz und technische `fsType`-Vorgaben; Text darf nicht still in ein Bild umgewandelt werden.

## 6. Import-/Exportplan

Die vollständige, nach Version getrennte Matrix steht in [FORMATE.md](FORMATE.md). Jeder Adapter besitzt Erkennung, Validierung, Import, Export und einen Bericht mit Warnungen. Eingabedateien bleiben unverändert, bis explizit an einen gewählten Pfad gespeichert wird.

Priorität: eigenes Format und Text → HTML/Markdown → grundlegendes DOCX und PDF-Ausgabe → ODT/RTF/EPUB → komplexe DOCX-/ODT-Funktionen und PDF-Import. Das alte binäre `.doc` ist kein `.docx` mit anderer Endung und benötigt später einen gesonderten, isolierten Konverter.

PDF-Import ist Rekonstruktion aus Zeichenpositionen, Bildern und geometrischen Elementen. Absätze, Lesereihenfolge, Tabellen und Fußnoten können fehlen oder mehrdeutig sein. Gescannte PDFs brauchen später OCR. Eine PDF ist deshalb kein verlustfreier Ersatz für das editierbare Original.

## 7. Wichtigste Tastenkürzel

Die folgende Belegung ist die verbindliche Zielbelegung. Im MVP sind nur die im Menü bzw. in der Befehlspalette ausgewiesenen Befehle verfügbar. Nicht implementierte Tastenkürzel werden nicht beworben. Windows-Konventionen gelten auch bei deutscher Oberfläche.

| Kürzel | Befehl |
| --- | --- |
| Strg+N / Strg+O / Strg+S | Neu / Öffnen / Speichern |
| Strg+Umschalt+S | Speichern unter |
| Strg+Z / Strg+Y | Rückgängig / Wiederholen |
| Strg+B / Strg+I / Strg+U | Fett / Kursiv / Unterstrichen |
| Strg+F / Strg+H | Suchen / Ersetzen |
| Strg+K | Befehlspalette |
| Strg+P | Drucken / PDF-Ausgabe; nicht zugleich zweite Befehlspalette |
| Strg+Alt+1 … 6 | Überschrift 1 … 6 |
| Strg+Alt+0 | Normaltext |
| Strg+Umschalt+7 / 8 | Nummerierung / Aufzählung |
| Strg+Umschalt+K | Link einfügen, da Strg+K die Palette öffnet |
| Strg+Alt+F | Fußnote einfügen |
| Strg+Umschalt+V | Ohne Formatierung einfügen |
| F6 / Umschalt+F6 | Nächsten / vorherigen Hauptbereich fokussieren |
| F11 / Esc | Fokusmodus umschalten / Dialog oder Fokusmodus verlassen |

Editorbefehle dürfen keine Systemkürzel oder AltGr-Eingaben für deutsche/internationale Zeichen blockieren. Insbesondere Strg+Alt ist auf manchen Layouts AltGr; die endgültige Belegung wird mit deutscher Windows-Tastatur überprüft und bei Konflikten anpassbar gemacht.

## 8. Konkreter Plan für die erste nutzbare Version

### Schritt A – Paketierbares Grundgerüst

Electron Main, sichere Preload-Bridge, React-Shell, Editor und versioniertes Dateischema einrichten. Entwicklungs- und Produktionsstart trennen. Ergebnis: leere App lässt sich als Windows-Paket starten und verarbeitet keine externen Ressourcen im Hintergrund.

### Schritt B – Schreiben und Datensicherheit

Rich Text, Undo/Redo, Öffnen/Speichern, sichtbare ungespeicherte Änderungen und Recovery. Recovery nach jedem tatsächlich persistierten Stand testbar machen. Ungültiges JSON und zukünftige Schemaversionen führen zu hilfreichen Fehlermeldungen.

### Schritt C – Nützliche Dokumentwerkzeuge

Überschriften, Listen, einfache Tabellen/Bilder/Links, Navigator, Wortstatistik, Fokusmodus, Dark Mode, Suche und Befehlspalette. Aktionen erhalten einen gemeinsamen Command-Vertrag. Funktionsschaltflächen ohne Verhalten werden ausgelassen.

### Schritt D – Weitergabe

Text/HTML/Markdown und DOCX-Grundfunktionen; PDF über Electron. Importwarnungen, sichere Ressourcenbehandlung und bewusst begrenzte Formatabdeckung. PDF-Seitenumbrüche und Umbrüche auf Windows mit Referenzdateien prüfen.

### Schritt E – Prüfen und veröffentlichen

Gezielte Tests für Dateischema und Migration, beschädigte Dateien, Undo/Redo sowie konvertierte Struktur. Manuelle Prüfung auf Windows 10/11, deutsches Tastaturlayout, dunkles/helles Systemdesign, 100-/150-/200-Prozent-Skalierung und Narrator. Start-/Eingabemessungen protokollieren.

GitHub-Vorabrelease mit Quellstand, versioniertem Windows-Artefakt, SHA-256-Prüfsummen, Installations-/Startanleitung, tatsächlichen Testresultaten und bekannten Grenzen erstellen. Ein nicht signierter Build wird als solcher benannt; ohne Signatur darf keine SmartScreen-Freigabe behauptet werden. Release nur als „Windows getestet“ bezeichnen, wenn er tatsächlich auf Windows ausgeführt wurde. Nicht vorhandene Funktionen werden in der Roadmap belassen.

### Grobe Zeitplanung

Als erste Schätzung für eine erfahrene Vollzeitentwicklerin bzw. einen erfahrenen Vollzeitentwickler mit vorhandener Entwicklungsumgebung: Grundgerüst in Woche 1; Editor und sichere Speicherung in Woche 2–3; Tabellen, Bilder, Navigator und benannte Stilregeln in Woche 4–5; Konverter und Desktop-PDF in Woche 6–7; Windows-Prüfung und Releasehärtung in Woche 8. Ein kleiner Prototyp kann früher entstehen; diese Schätzung betrifft eine brauchbar geprüfte Vorabversion, keine Garantie.

Für Version 1.0 folgen mehrere weitere Entwicklungszyklen. ODT, anspruchsvolle Pagination, Offline-Proofing, Fontverwaltung und Office-Roundtrip erhalten jeweils eigene technische Vorversuche und Abnahmen. Nach den ersten Messungen wird die Roadmap neu geschätzt; eine vollständige Alternative zu jahrzehntelang entwickelten Office-Suiten lässt sich nicht verantwortbar in wenige Wochen zusagen.
