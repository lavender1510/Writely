# Writely 0.4.0-alpha.1 – Produktivität und Datensicherheit

Entwicklungsstand für den Pull Request auf Basis von 0.3.0-alpha.1. Dieses Update veröffentlicht keinen GitHub-Release. Windows-Setup und portables ZIP werden zunächst ausschließlich als geprüfte CI-Artefakte bereitgestellt.

## Tatsächlich umgesetzt

### Bibliothek und Datensicherheit

Entfernen verschiebt ein Dokument in den Papierkorb. Ordnerzuordnung, Titel, Zeitstempel, Anheftung, Vorschau und Inhalt bleiben erhalten. Wiederherstellen verwendet die bisherige Zuordnung; wurde der Ordner entfernt, landet das Dokument unter „Meine Dokumente“. Endgültiges Entfernen verlangt in der Desktop-App eine native Bestätigung. Die Hauptprozess-Bridge prüft diese Bestätigung selbst; ein vom Renderer mitgesendetes `confirmed` umgeht den Dialog nicht. Zugehörige lokale Versionen und Recovery-Stände werden entfernt. Selbst gewählte Originaldateien im Explorer werden dabei nicht gelöscht.

Jede Bibliotheksänderung schreibt zunächst eine neue, unveränderliche Dokumentrevision und danach atomar den Index. Erst nach dem Commit werden unreferenzierte interne Revisionen entfernt. Bei einem Index-Schreibfehler bleibt die vorherige Revision lesbar. Beim Start werden abgebrochene, nicht referenzierte Revisionen und erkannte temporäre Dateien bereinigt. Ein beschädigter Index verhindert die Bereinigung statt Dokumentdateien auf Verdacht zu löschen.

### Verlauf und Backups

Der Verlauf zeigt ausschließlich Versionen des aktuellen Dokuments mit Name und Erfassungszeit. Eine schreibgeschützte Vorschau zeigt Text, Tabellen, Bilder und Notenreferenzen. Wiederherstellen sichert zuerst die aktuelle Fassung. Einstellungen begrenzen Versionenzahl (3–500), Intervall (1–60 Minuten) und Speicher (64–1024 MB) getrennt pro Dokument. Mindestens die neueste Fassung bleibt erhalten. Beschädigte einzelne Versionsdateien verdecken gesunde Fassungen nicht.

Ein Bibliotheksbackup enthält aktive Dokumente und Papierkorb, Ordner, eigene Vorlagen, Vorlagensätze und Bibliotheksmetadaten. SHA-256, Format, Dokumente, IDs und Ordnerhierarchie werden vor der Übernahme geprüft. Der Import ergänzt Einträge mit neuen Dokument-/Ordner-IDs; vorhandene Dokumente werden nie ersetzt und ursprüngliche Dateipfade werden nicht als Schreibberechtigung reaktiviert. Mehrfacher Import erzeugt zusätzliche Kopien. Das Backup ist derzeit auf 256 MB begrenzt. Separate Versionsdateien, Fensterpräferenzen, Benutzerwörterbuch und externe Explorer-Originaldateien gehören nicht zu diesem Bibliotheksbackup.

### Suche

Die nichtmodale Suchleiste hebt Treffer live hervor, zeigt aktuelle Position/Gesamtzahl und bietet Vor/Zurück, Einzelersetzung sowie „Alle ersetzen“. Groß-/Kleinschreibung und reguläre Ausdrücke sind wählbar. Text-Runs werden innerhalb eines Absatzes zusammengeführt, sodass eine Formatierungsgrenze einen Treffer nicht unterbricht. Geschützte Leerzeichen werden bei normaler Textsuche wie Leerzeichen behandelt. Ersetzungen laufen in einer rückgängig machbaren Editortransaktion; Ersetzungstext ist wörtlich, ohne `$1`-Gruppensubstitution.

Die Suche läuft in einem separaten Web Worker. Nach 200 ms Rechenzeit wird der Worker beendet; Laden des Workers zählt nicht zu diesem Budget. Grenzen: 256 Zeichen Suchmuster, vier Millionen Textzeichen und 5.000 Treffer. Bei unvollständiger Trefferliste ist Ersetzen deaktiviert. Suchtexte werden nicht im Renderer als Regex ausgeführt. Die Live-Suche durchsucht Absatz-/Tabellentext; Notentexte im separaten Notendialog werden dort noch nicht durchsucht.

Die Bibliothek durchsucht auch Dokumentinhalte und Notentexte und zeigt Titel plus Ausschnitt. Papierkorb-Einträge werden ausgeschlossen. Bis zu 100 Dokumenttreffer werden zurückgegeben; der Textcache ist begrenzt und wird bei neuen Revisionen invalidiert. Das ist eine lokale dateibasierte Suche, noch kein persistenter Volltextindex.

### Vollständig lokale Rechtschreibung

Deutsch und Englisch (US) sind mit lokal beigefügten Hunspell-Wörterbüchern verfügbar. Sprache und Aktivierung werden pro Dokument gespeichert. Fehler erscheinen als rote Wellenlinien; Rechtsklick oder Umschalt+F10 am Fehler öffnet Vorschläge. Eine Korrektur ist rückgängig machbar. Eigene Wörter können im Menü ergänzt und unter Einstellungen sprachbezogen verwaltet werden. Nspell arbeitet in einem separaten Node-Worker. Die Chromium-Rechtschreibung ist deaktiviert; Writely lädt keine Wörterbücher nach und überträgt keine Texte an Prüfdienste.

Die Prüfung ist wortbasiert. Grammatik, regionale Wörterbuchvarianten, Sprachen pro Textbereich und vollständige Erkennung deutscher Zusammensetzungen sind offen. Eigennamen und manche gültigen zusammengesetzten Wörter können markiert werden. In der Browser-Vorschau wird die fehlende Desktop-Wörterbuch-API ausdrücklich angezeigt.

Deutsch: dictionary-de 3.0.0 / igerman98 20161207, GPL 2 oder 3; beide Lizenztexte und korrespondierender igerman98-Quellcode liegen bei. Englisch: dictionary-en 4.0.0, MIT/BSD. Siehe [Wörterbuchherkunft und Lizenzen](../dictionaries/README.md).

### Verzeichnisse und Noten

Ein eigener Inhaltsverzeichnis-Knoten zeigt die echten Überschriften bis Ebene 6. Einträge aktualisieren sich bei Änderungen automatisch und springen beim Anklicken zur Überschrift. Stabile Überschriftenanker bleiben im Dokument erhalten. Der bestehende Style „Verzeichnis“ formatiert Einträge. Es werden keine unzuverlässigen Seitenzahlen erfunden.

Fuß- und Endnoten sind echte Inline-Knoten mit ID, Typ und bearbeitbarem Klartext. Die Nummerierung wird aus der Reihenfolge abgeleitet, getrennt für Fuß-/Endnoten. Die Notenliste führt zum Bearbeitungsdialog. Einfügen, Ändern und Entfernen sind Editoraktionen mit Undo/Redo.

DOCX und ODT erzeugen native Fuß-/Endnoten. Ihr externer Import übernimmt Notentexte als Klartext; unveränderte Writely-Pakete erhalten zusätzlich das genaue eigene Modell. DOCX erhält anklickbare Verzeichniseinträge als Momentaufnahme mit gültigen Bookmark-Namen. ODT enthält ein natives Verzeichnis mit Eintragskörper. PDF und HTML geben verlinkte Noten am Dokumentende aus; PDF setzt noch keine echten Fußnoten am unteren Seitenrand. Für diese Abweichung und statische Verzeichnisse zeigt die App vor der Ausgabe konkrete Hinweise mit Abbruchmöglichkeit. RTF, Markdown und TXT erhalten Textdarstellungen; EPUB bleibt umfließend.

### Oberfläche

Neue Funktionen verwenden die vorhandenen violetten Farben, Ribbon-Bereiche und Dialogformen. Suche, Verlauf, Noten, Rechtschreibwerkzeuge, Wörterbuchverwaltung und Dokumentaktionen sind eigene UI-Module. Neue Hauptdialoge halten den Tastaturfokus und geben ihn beim Schließen zurück. Lade-/Speicher-/Fehlerzustände bleiben sichtbar. Fenster-/Monitoreinstellungen aus 0.3 bleiben erhalten.

## Dokumentversion und Kompatibilität

Neu gespeicherte Dokumente verwenden Schema 2. Die explizite Migration kopiert Schema-1-Dateien ohne Veränderung von Inhalt, Bildern, Tabellen oder Layoutdaten und ergänzt Standardwerte für die Rechtschreibung. Unbekannte Schemaversionen werden abgelehnt. Neue Noten-/Verzeichnisknoten in Schema 1 werden ebenfalls abgelehnt. Recovery und alte Versionsdateien werden beim Lesen migriert; Quelldateien im Explorer werden erst bei einem ausdrücklich gewählten Speichervorgang geändert. Writely 0.3 kann Schema-2-Dateien nicht öffnen.

## Tastatur

| Aktion | Bedienung |
| --- | --- |
| Dokument suchen / ersetzen | Strg+F / Strg+H |
| Bibliotheks-Volltextsuche | Strg+F auf dem Startbildschirm |
| Nächster / vorheriger Treffer | Enter / Umschalt+Enter im Suchfeld; entsprechende Schaltflächen |
| Fußnote / Endnote | Strg+Alt+F / Strg+Alt+E oder Befehlspalette |
| Rechtschreibvorschläge | Umschalt+F10 an einer roten Markierung; Pfeiltasten und Enter im Menü |
| Inhaltsverzeichnis / Verlauf | Befehlspalette Strg+K oder Ribbon/Sidebar |
| Dialog schließen | Esc; Tab/Umschalt+Tab bleiben in neuen Hauptdialogen |
| Rückgängig / Wiederholen | Strg+Z / Strg+Y |

## Architektur und geänderte Bereiche

| Dateien | Entscheidung |
| --- | --- |
| `electron/library.cjs` | Transaktionaler Index mit unveränderlichen Revisionen, Papierkorb, GC, lokaler Suche und validierten Backup-Merges |
| `electron/storage.cjs` | Migration beim Lesen, neue Knotenschemata, getrennte Retention, Vorschau und persistierte Verlaufseinstellungen |
| `electron/document-schema.mjs` | Gemeinsame Migration, abgeleitete Referenzen und konkrete Exportwarnungen für Frontend/Adapter |
| `electron/proofing.cjs`, `spell-worker.cjs`, `dictionaries/` | Begrenzte lokale Wörterbuch-API, persistente eigene Wörter und Hintergrundberechnung; Worker/deps explizit aus ASAR entpackt |
| `electron/main.cjs`, `preload.cjs` | Eng begrenzte IPC statt Node-/Dateisystemfreigabe; native Bestätigungen, lokale Dateidialoge und neue Dienste |
| `electron/formats.cjs`, `odt.cjs`, `docx-layout.cjs`, `odt-layout.cjs`, `print-layout.cjs`, `converters.cjs` | Native Noten, Verzeichnisdarstellungen, Notenimport und geordnete PDF-Anhänge |
| `src/SearchPanel.tsx`, `search-worker.ts`, `search-core.mjs`, `search-editor.ts` | Debounce, isolierte Regex-Ausführung, Positionsabbildung und ProseMirror-Dekorationen |
| `src/ProofingTools.tsx`, `proofing-editor.ts`, `DictionarySettings.tsx` | Lokale Prüfung, Markierungen, Kontextmenü und Benutzerwörterbuch |
| `src/VersionHistory.tsx`, `LibrarySettings.tsx`, `DocumentActions.tsx`, `dialog-focus.ts` | Ausgelagerte, tastaturbedienbare Verwaltungs-/Sicherungsdialoge |
| `src/references-editor.ts`, `NotesPanel.tsx`, `shared.ts`, `document.ts` | Noten-/TOC-Knoten, stabile Anker, abgeleitete Nummerierung, Style-Anbindung und Dokumentvertrag |
| `src/App.tsx`, `Home.tsx`, `browser.ts`, `library.ts`, `styles.css` | Integration, aktuelle Snapshot-Erfassung, Bibliothekssuche und passende Browser-Vorschau |
| `tests/*`, `scripts/desktop-smoke.cjs`, `.github/workflows/windows.yml` | Bestehende Regressionen plus neue Funktionen, tatsächlicher Absturz/Neustart und Prüfung des Windows-Pakets |

Die alte Ribbon-Komponente bleibt teilweise umfangreich. Größere Archive verwenden weiterhin dateibasierte Scans statt einer Such-/Versionsdatenbank. Automatisch paginierte Bearbeitung, TOC-Seitenzuordnung, Rich-Text-Noten und neue Querverweistypen sind eigenständige nächste Ausbaustufen. Eine vollständige visuelle Word-/LibreOffice-Kompatibilitätsabnahme oder ein Leistungsversprechen für beliebig große Dokumente wird nicht behauptet.

## Prüfstand

- Produktionsbuild und TypeScript-Prüfung.
- 66 Unit-/Modell-/Format-/Dienste-Tests, einschließlich der bisherigen Tests.
- 17 Playwright-Tests gegen den Produktionsbuild: Speichern, Recovery, Dokumentwechsel, globale Styles, Tabellen/Bilder, Layout-Undo, Light/Dark, Bibliothek/Papierkorb, Textsuche über Mark-Grenzen, Abbruch gefährlicher Regex, dynamisches TOC und Noten-Undo/Recovery.
- Echter Electron-Desktoptest: isolierte Bridge, native Dateidialoge, Wörterbücher, Bibliotheksbackup, Löschbestätigung, DOCX/ODT/PDF, Schrift-/Unicode-Prüfung, gemischte Papiergrößen, Vorschau, harter Prozessabbruch/Neustart und frische Eingaben beim nativen Schließen.
- Paketierte Linux-App lokal geprüft; Windows-CI baut Setup/ZIP und prüft anschließend ebenfalls die fertig gepackte App.

Vorübergehende EPERM-/EACCES-/EBUSY-Sperren beim atomaren Umbenennen werden begrenzt wiederholt, ohne die Zieldatei zu löschen. EACCES/ENOSPC werden kontrolliert durch Fehlerinjektion geprüft, ohne Datenträger tatsächlich zu füllen. Ein harter Abbruch kann noch nicht auf die Platte geschriebene Eingaben innerhalb der Auto-Save-Verzögerung verlieren; der Crash-Test prüft den zuletzt erfolgreich geschriebenen Stand. Beim normalen Schließen wird zusätzlich die neueste Editorfassung angefordert.

Maßgeblich für den jeweiligen PR-Commit sind die verlinkten erfolgreichen CI-Läufe und deren Artefakte. Es erfolgt kein Release-Publish-Schritt ohne gesonderte Freigabe.
