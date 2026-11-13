# Bücher- und Bibliotheksentwicklung

Analyse vom 13. November 2026. Basis: `5eca3fe`, Android 0.5.0-alpha.3. `main` (`df50b68`) enthält die offenen PRs #1 → #2 → #3 → #4 → #5 nicht. Kein automatisches Mergen, kein Release. Die gelieferte ZIP enthält 42 Screenshots fremder Autorenprogramme; sie ist eine Referenz für Hierarchie, Karten, Planung und Buchausgabe, kein Quellcode. Keine fremden Assets werden übernommen.

## Verifizierter Architekturstand

| Bereich | Bestand Windows / Android | Fehlender Umfang und Abnahme |
|---|---|---|
| Dokumentkern | gemeinsame Schema-Versionen 1/2, Migration, Rich Text, Tabellen, Bilder, Textnoten | formatierte Noten, vollständige Office-Abbildung und Revisionsmodell fehlen |
| Bibliothek | Windows: transaktionaler Index und unveränderliche Revisionen; Android: verschlüsselter Gesamttresor | atomare Zielordnerzuweisung beim Erstellen unter Windows fehlt; implizites Tresor-put kann Zuordnung zurücksetzen |
| Ordner | Hierarchie, Umbenennen/Verschieben, teils Farben/Symbole, Dokumentpapierkorb | gemeinsame Breadcrumbs, aktiver Erstellungsordner, Mehrfachoperationen, Ordnerpapierkorb und Touch-Dialoge fehlen |
| Oberfläche | Desktop-Ribbon; mobiles kompaktes UI, horizontaler Toolbar, Themes inkl. AMOLED | Bücher-Navigation, gemeinsamer Erstellungsdialog, mehr Tablet-Arbeitsbereiche fehlen |
| Seitenlayout | Abschnittsmodell, manuelle Umbrüche, Layoutdialog; Desktop-Druck/PDF | `core/page-plan.ts` verteilt bereits gemessene Fragmente; keine DOM-Zeilenmessung, Caches, Tabellenfragmentierung oder editierbare Pagination |
| Ansichten | kontinuierlicher Android-Editor, Desktop-Seitenoptik und Druckfenster | Seitenoptik ist kein geprüfter WYSIWYG-Seiteneditor; keine erfundenen Seitenzahlen |
| Vorlagen/Styles | gemeinsame Dokumentvorlagen, Themes/Cover, Absatzvorlagen und Vererbung | keine getrennten Buchdesigns, Zeichen-/Seiten-/Rahmenstylefamilien |
| Autorenprojekte | nicht implementiert | Buchmodell, Binder, Kapitel/Szenen, Karten, Gliederung, Story-Bible, Plot, Ziele fehlen |
| Import/Export | Desktop Pandoc und gemeinsame DOCX/ODT-Writer; Android DOCX/ODT mit konkreten Grenzen, TXT/HTML | echter EPUB-3-Buchexport, private/explizite Publikationsauswahl, EPUBCheck und mobile Druckadapter fehlen |
| Sicherheit | AES-256-GCM, Argon2id, atomarer verschlüsselter Tresor, Historie/Backups verschlüsselt | individuelle Schlüsselbereiche/Keystore-Biometrie fehlen; kein kosmetischer Kennwortschutz |
| Skalierung | einzelnes Dokument pro Editor, verzögertes Speichern, begrenzte Caches | Gesamttresor wird als Ganzes serialisiert/verschlüsselt (64 MiB); keine Behauptung skalierbarer 100-Kapitel-Architektur |
| Tests/CI | 80 Unit-/26 Browsertests, Electron-Smokes, Windows Setup/ZIP, Android Build + API-35-Instrumentierung | neue Bedienaktionen/Regressionen, Buchkorpus, EPUBCheck und reproduzierbare Benchmarks ergänzen |

## Reihenfolge, Risiken und Abnahme

1. **Bibliothek/Ordner:** gemeinsamer validierter Ordnerkern; Erstellen/Import/Vorlage mit Zielordner in derselben Transaktion; Autosave ohne implizite Verschiebung; Dialoge, Breadcrumbs, Farben/Symbole/Pin, Mehrfachverschieben und DnD; Ordnerpapierkorb mit rekursiver, zuordenbarer Wiederherstellung. Abnahme: verschachtelt erstellen → schreiben → schließen/neustarten → Zuordnung unverändert; ungültiger Zielordner, Zyklus, Schreibfehler und gleichzeitige Operationen verlieren keine Daten. Bestehende Explorer-Dateien nie ungefragt verschieben/löschen.
2. **Buchprojekte:** versioniertes Projektmodell mit stabilen IDs, Kapitel/Szenen als gewöhnliche Writely-Dokumente, Binder/Karten/Gliederung und Projekt-Dashboard. Zuerst sichere Repository-/Transaktionsgrenzen und Backups, dann UI. Nur ausgewähltes Kapitel in den Editor laden. Keine zweite Editorimplementierung.
3. **Autorenwerkzeuge:** referenzierte Figuren/Orte/Story-Bible, Plotstränge/-punkte, relative Timeline, Recherche und Ziele auf demselben Modell. Integritätsregeln für Löschen/Umhängen und Backup-ID-Neuzuordnung testen.
4. **Dokumentansichten:** vorhandenen Seitenplan um browserbasierte Zeilen-/Tabellenmessung, Schriftladebarriere, inkrementelle Caches und stabile PM-Positionsintervalle erweitern. Erst Layoutfixtures einschließlich mehrseitiger Tabellen/Fußnoten validieren, dann editierbare Seitenansicht und Virtualisierung. Ein CSS-Rechteck zählt nicht als fertig. Keine Dokumentknoten für bloße View-Zustände schreiben.
5. **Buchausgabe:** Compiler mit ausdrücklicher Manuskriptauswahl (kein Research/Story-Bible), gemeinsame Exportmodelle, DOCX und EPUB 3 inklusive Manifest/Spine/Nav/Cover/Bilder; EPUBCheck und E-Reader prüfen. PDF nutzt geprüften Desktopdruck; Android benötigt nativen Adapter. Typografie-/Seitenvorschauen nur auf Basis tatsächlicher Ausgabe.
6. **UI/UX:** einheitlicher Neu-erstellen-Einstieg und Bücherbereich, kontextbezogene Autorenwerkzeuge; Smartphone-Drawer/Tablet-Split-View, Tastatur und Screenreader. Bestehende Windows- und Android-Befehle erhalten.
7. **Performance/Abschluss:** 100.000 Wörter, 100 Kapitel und Medien messen; Chunks mit authentifiziertem Manifest und Recovery-Journal statt unkontrollierter Tresorvollmigration. Grenzen dokumentieren, echte Geräte gesondert prüfen. Windows-/Android-Artefakte aus geprüftem Commit, abgegrenzte PRs; keine Veröffentlichung.

Datensicherheit geht vor Funktionsbreite. Speicherformatänderungen müssen alte Daten explizit lesen und neue Formate vor alten Apps schützen. Keine privaten Suchindizes/Previews in Klartext, keine Vorab-Löschung der alten Datei. Tests werden weder entfernt noch übersprungen, um einen Build zu erzwingen. Bekannte Abweichungen bleiben in ANDROID-PARITY.md / WRITER-ROADMAP.md sichtbar.

## Meilenstein 1 – Implementierung

- Neue Dokumente, Vorlagen und Dateidialog-Importe übernehmen den ausgewählten Zielordner sofort. „Neue Inhalte in“ ist mit dem aktuellen Ordner vorbelegt und lässt sich ausdrücklich ändern. Autosave/Öffnen vorhandener Dokumente ohne Zielargument verschieben nichts. Desktop-IPC überträgt die geprüfte Ordner-ID in denselben Commit wie den Dokumentinhalt. Duplikate behalten ihre Zuordnung.
- Gemeinsamer Ordnerkern für Zyklenprüfung, Breadcrumbs, Ziele, Farben/Symbole/Pin, atomare Sammelverschiebungen und Papierkorb. Desktop unterstützt echtes HTML5-Drag-and-drop; auf Touchgeräten sind dieselben Operationen über Auswahlfelder und Dialoge erreichbar. Keine Behauptung nativen Android-Drag-and-drops.
- Ordner und aktive Unterinhalte gehen zusammen in den Papierkorb. Ein Löschvorgang erhält eine eigene Batch-ID. Die Wiederherstellung stellt diesen Baum inklusive Zuordnung wieder her; vorher getrennt gelöschte Inhalte bleiben gelöscht. Backup-Import vergibt auch neue Batch-IDs, damit eine importierte Wiederherstellung den Originalbestand nicht verändert.
- Windows-/Browserindex schreibt Version 3; alte Indexversionen 1/2 werden weiterhin gelesen. Verschlüsselter Tresor liest Version 1/2 und schreibt nach einer Änderung Version 2. AES-GCM-Dateihülle und Dokumentformat bleiben unverändert. Ältere Appversionen müssen neue Bibliotheks-/Tresorversionen ablehnen; vor einem Downgrade ein Backup mit der aktuellen App exportieren. Keine automatische Rückmigration und keine Löschung der bisherigen Quelldatei.
- Fehlerhafte Ziele, teilweise ungültige Mehrfachauswahl und Schreibfehler brechen den gesamten Commit ab. Öffnen, Suche und verspätete Saves können Inhalte im Papierkorb nicht zurückholen.

Die optionale rekursive Ordnerduplikation ist nicht Bestandteil dieses Meilensteins. Ganze Ordnerbäume können aus dem Papierkorb wiederhergestellt werden; ein dauerhaftes Leeren von Ordnerbäumen wird nicht als neuer Schnellbefehl angeboten. Bestehendes bestätigtes endgültiges Dokumentlöschen bleibt erhalten.

### Gemessene Skalierungsgrenze vor Meilenstein 2

Reproduzierbar: `node --import tsx scripts/benchmark-library.mts` (synthetische Daten, Linux/Node 24; ein Durchlauf, keine statistische Performancegarantie). Bei 102 Dokumenten einschließlich eines 100.000-Wörter-Manuskripts dauerte das Speichern eines kleinen Dokuments ca. **15 ms** in der nativen Bibliothek und **150 ms** im Gesamttresor; das Erstellen von 100 Dokumenten ca. **0,93 s** bzw. **15,16 s**. Native Index-Ladezeit ca. **1,7 ms**, Tresor-Entsperren einschließlich KDF ca. **840 ms**. Details werden als JSON-Testartefakt ausgegeben. Dies misst Repository-Operationen, keine UI-Startzeit, Eingabelatenz, Druckseiten oder Android-RAM-Eignung.

Das ist ein konkreter Grund, große Buchprojekte nicht ungeprüft in den Gesamttresor einzubauen. Vor produktivem Bücher-Modus: authentifiziertes Projektmanifest, einzeln verschlüsselte Kapitel-/Asset-Blöcke, atomarer Manifestwechsel mit Journal/Recovery, kopierender Import und erst nach geprüftem Commit bereinigte Altdateien. Beschädigte/unbekannte Blöcke dürfen nicht als leere Kapitel gespeichert werden. Erst danach folgen Binder, Karten, Plot und Export auf dieser gemeinsamen Repository-Schnittstelle. Die bestehenden Dokumente bleiben bis dahin im bewährten Speicher; kein unsicherer Migrationsschalter.

### Stand der Tests

Neue Unit-Tests prüfen Zielordner beim Erst-Commit, Autosave nach Neustart, fehlende Ziele, Zyklen, ENOSPC-Rollback, atomare Sammelaktionen, ältere Papierkorbeinträge und getrennte Backup-Batches in nativer und verschlüsselter Ablage. Browseraktionen prüfen verschachtelte Erstellung, Vorlagen/Import, Ordnerdesign, Mehrfachverschieben, echtes DnD, Wiederherstellung, Zielüberschreibung sowie verschlüsselten Erhalt nach Reload. Android-Instrumentierung erstellt zusätzlich einen Ordner und darin ein Dokument; der Node-Rücktransfer prüft die Zuordnung in der tatsächlich gespeicherten verschlüsselten Datei. Tatsächliche Laufresultate werden im PR verlinkt; ein bloßer Build ist kein Funktionsnachweis.
