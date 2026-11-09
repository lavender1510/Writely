# Writer-Entwicklungsplan und Feature-Gaps

Basis: `feat/android-feature-parity` / `0dda68f` (0.5.0-alpha.2), einschließlich PR #1 → #2 → #3. Main ist weiterhin `df50b68`, Windows-0.4 `3663733`, gemeinsamer Android-Kern `a4f7505`. Keine bestehenden PRs werden automatisch gemergt.

Die detaillierte Bestandsmatrix in ANDROID-PARITY.md bleibt maßgeblich. Diese Writer-Matrix ergänzt sie; „vollständig“ bedeutet jeweils nur den angegebenen unterstützten Umfang, nicht LibreOffice-Kompatibilität. Vorliegende Belege: 77 Unit-/23 Browserprüfungen, echte Desktop-/Android-Prüfungen aus PR #3. Neue Ergebnisse werden separat ausgewiesen.

| Funktionsfamilie | Writely Windows / Android | Writer-Gap und Abnahme |
|---|---|---|
| Rich Text, Listen, Überschriften, Undo/Redo | vollständig im vorhandenen Schema, gemeinsame Commands | echte Bedienaktionen und Format-Roundtrips erhalten |
| Absatzstyles, Vererbung, Themes, Cover | teilweise | Abstände/Einzüge/Umbruchregeln in Modell, UI, CSS, DOCX und ODT gemeinsam; Vererbung testen |
| Zeichen-, Seiten-, Listen-, Rahmenstyles | nicht implementiert als getrennte Stylefamilien | versionierte Typen, Manager, Export und Migration erforderlich |
| Manuelle Seiten-/Abschnitts-/Spaltenumbrüche | vorhanden | bestehende Positions- und Historieninformationen schützen |
| Automatische editierbare Pagination | nicht implementiert | Zeilen-/Zellenmessung, Footnote-Fixpunkt, Positionsabbildung und Viewportvirtualisierung; keine CSS-Seitenattrappe |
| Gemischte Papierformate, Ränder, Spalten, Header/Footer | teilweise; Ausgabe Windows weiter als Android | gemeinsamer PagePlan und visuell geprüfte Ausgabe erforderlich |
| Tabellen, Zellenverbinden, Bilder und Canvas-Grafiken | teilweise | Tabellenfragmentierung, Zeilenhöhen, Rahmen, Beschriftungen und Objektanker fehlen |
| Kommentare, Antworten, Änderungen, Vergleich | nicht implementiert | persistente Annotationen, Positionsmapping, echte Revisionsoperationen und Exportabbildung |
| Dynamisches TOC, Text-Fuß-/Endnoten | teilweise | verifizierte Seitenzahlen, formatierte Noten und echte Fußposition fehlen |
| Weitere Verzeichnisse, Querverweise, Bibliografie | nicht implementiert | stabile Ziel-IDs, Feldauswertung und Quellenmodell erforderlich |
| Freie Rahmen, Vektorgruppen, Ebenen | nicht implementiert | Layoutobjektmodell statt bloßer Rasterisierung |
| Strukturierte Mathematik | nicht implementiert | MathML/OMML-Mapping und validierte Konverter erforderlich |
| Offline-Rechtschreibung DE/EN | plattformabhängig, Windows vorhanden | mobiler Worker und verschlüsselte persönliche Wörter; Autokorrektur/Trennung/Thesaurus fehlen |
| DOCX/ODT | teilweise | Writer-Korpus und LibreOffice-Ausgabeprüfung fehlen; externe Android-ODT-Semantik fehlt |
| PDF/Druck, Seitenwahl, Metadaten, Fonts | plattformabhängig; Windows teilweise | Android-Printadapter und gemeinsamer Layoutnachweis fehlen; keine PDF/A-/UA-Behauptung |
| RTF/EPUB/Markdown/HTML/TXT | teilweise/plattformabhängig | Desktop-Pandoc nicht mobil ausführbar; genaue Verluste siehe Paritätsmatrix |
| Serienbriefe, CSV-Felder, Etiketten | nicht implementiert | typisiertes Feldmodell, CSV-Parser, Vorschau und Serienexport |
| Masterdokumente und Kapitelverknüpfung | nicht implementiert | lazy Kapitelrepository, globale Ziel-/Nummerierungsauflösung |
| Formulare und sichere Automatisierung | nicht implementiert | deklarative Felder; keine fremden Makros automatisch ausführen |
| Bibliothek, verschlüsselte Vorlagen, Papierkorb, Historie | teilweise | skalierende Objektablage, Medien-Deduplizierung und globale Suche fehlen |
| AES-GCM/Argon2id-Tresor, Sperre, Backup | vollständig im dokumentierten Tresorumfang | unverändert erhalten; keine Klartextmigration |
| Individuelle Schlüsselbereiche, Keystore/Biometrie | nicht implementiert | eigene Schlüsselhierarchie und atomare Migration erforderlich |
| Barrierefreiheit, Smartphone/Tablet, Arbeitsbereiche | teilweise | Screenreader-/IME-/Gerätematrix, Fokusführung, skalierende Ansichten |

## Abhängige Meilensteine

A wird in integrierbare Teile zerlegt: A1 erweitert Absatzstyles durchgängig und liefert einen reinen, testbaren Seitenplan-Kern. A2 ergänzt DOM-Zeilenmessung und invalidierbaren Layoutcache. A3 integriert Seitenansicht, Positionsmapping, Tabellenfragmente und Virtualisierung. A4 vereinheitlicht Druck/PDF und Footnote-Fixpunkt. **A1 allein ist keine abgeschlossene WYSIWYG-Layoutengine.**

B: Annotationen/Revisionen erst nach stabilem Positionsmapping; Rich-Text-Noten und Verweisfelder mit ausdrücklicher Schemamigration. C: Office-Korpus mit unabhängigen LibreOffice-Rendervergleichen; Android-Print und Formatadapter. D: Mathematik, Literatur, Serienbrief und deklarative Formulare. E: Masterdokumente, Objektablage, Performance, Plattform- und Accessibility-Abnahme.

## Risiken und Abnahmekriterien

- Messwerte sind abhängig von Fonts, Breite, DPI und Bildern. Cache muss diese Parameter berücksichtigen; unveränderte Präfixe dürfen nicht bei jedem Tastendruck gemessen werden.
- Pagination darf keine zusätzlichen Absätze oder Umbruchknoten zur Darstellung schreiben. Editorpositionen bleiben ProseMirror-Positionen; Seiten sind abgeleitet.
- Überhohe Zeilen/Bilder müssen mit konkretem Overflow gemeldet werden; keine Endlosschleifen oder still abgeschnittenen Inhalte. Tabellenzeilen und Fußnoten benötigen eigene Regeln.
- A1: Styles zentral vererbt und in Editor/Office abgebildet; Grenzen validiert; deterministische Seitenplanung, Positionssuche, gemischte Abschnitte, 50-/100-Seitenfälle getestet. Bestehende Dokumente/Tests bestehen weiter.
- A2–A4: echte Schrift-/Bildmessungen und Zeilenfragmente, messbare lokale Invalidierung, Auswahl/Undo unverändert, visuell geprüfte Seiten und Ausgabe. Kein Abschluss von A ohne diese Nachweise.
- Jeder weitere Meilenstein: eigener Branch/PR, Tests und Artefakte; keine Veröffentlichung ohne Freigabe.

## A1-Lieferumfang

Absatzvorlagen: gemeinsam validierte numerische Einzüge/Abstände, Ausrichtung, Zusammenhalten und Umbruch davor; Style-Manager auf Windows/Android, CSS, HTML, DOCX und ODT. ODT übernimmt nun auch Absatzformatierung auf dem ersten Absatz eines Abschnitts, ohne Masterpage-/Seitennummerierungsattribute zu überschreiben. Keine neue Dokumentversion nötig: additive optionale Style-Eigenschaften; unbekannte Dokumentknoten bleiben weiterhin gesperrt.

Der neue Seitenplan-Kern verarbeitet ausschließlich bereits gemessene Zeilen-/Zeilenfragmenthöhen, bewahrt Eingaben und Editorpositionen, berücksichtigt Abschnittskapazitäten/Umbrüche und meldet Überläufe. 50/100/500 Seiten in Kernprüfungen sind keine echte Editor-Performance- oder Drucklayoutmessung. Keine neue „Seitenansicht“-Schaltfläche, bevor DOM-Messung/Zeilenteilung/Fußnoten und Viewportintegration tatsächlich funktionieren. Meilenstein A insgesamt bleibt offen.

## Lokale A1-Prüfungen

Produktionsbuild/TypeScript bestanden. 80 Unit-Tests bestanden; 23 bisherige Browserprüfungen bestanden. Der ergänzte vierte Paritätstest betätigt den gemeinsamen Style-Manager auf Smartphonebreite und prüft die tatsächlich gerenderten Abstände in Pixeln; alle vier gezielten Paritätstests bestanden. CI wiederholt die vollständige Suite sowie Windows-/Android-Builds. Verbindliche Lauf- und Artefaktlinks stehen im PR. Die Seitentests messen nur den Planungskern, keine 500-Seiten-Schreibleistung.
