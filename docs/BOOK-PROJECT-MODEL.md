# Buchprojekte: Datenmodell und verschlüsselte Speicherung

Entwicklung ab Meilenstein 2 / `feat/book-projects`, auf PR #6. Dies dokumentiert das tatsächlich implementierte Speicherprotokoll; Designer, Story-Bible, Plot und Gesamtexport sind getrennte Folgeschritte. Keine LibreOffice-/EPUB-Kompatibilität durch eine sichtbare Schaltfläche behauptet.

## Gemeinsames Modell

Windows, Android und Browseradapter verwenden `core/book-types.ts`, `book-model.ts`, `book-repository.ts` und denselben Writely-Dokumentkern. Kein zweiter Rich-Text-Editor: Kapitel/Szenen bleiben gewöhnliche `DocumentFile`-Dokumente (Schema 1/2) mit den vorhandenen Tiptap-Erweiterungen. Die verschlüsselte Umgebung benutzt die isolierte Speicherstrecke; der normale Desktop-Editor mit seinem unverschlüsselten Autosave wird nicht versehentlich für geschützte Kapitel verwendet.

| Objekt | Inhalt und Beziehungen |
|---|---|
| BookReference | Projekt-ID, Titelcache, Erstellungsdatum, optional Papierkorbdatum und zufälliger 256-Bit-Projektschlüssel. Dieser Datensatz liegt ausschließlich im verschlüsselten Tresor-Payload. |
| BookProject, Schema 1 | ID, Revision, Titel/Untertitel, Autor/Pseudonym, Genre, Sprache, Beschreibung, private Notizen, Serie, Wortziel und Farbe; Statuskatalog, Coverreferenz, letzte Schreibposition als Kapitel-/Szenen-ID und hierarchische Einträge. |
| BookNode | Stabile UUID; Teil, Gruppe, Kapitel oder Szene; parentId, Reihenfolge, optionaler Titel, Zusammenfassung, private Notizen, Status-ID und Farbe. Kapitel/Szenen besitzen einen Dokumentverweis; Gruppen laden keine Dokumentinhalte. |
| Document slot | Aktuelle Block-ID, gemessene Wörter im Text, Änderungsdatum sowie bis zu fünf ältere bzw. benannte Sicherungspunkte. Ein Sicherungspunkt referenziert einen unveränderlichen Block, statt den Text im Manifest zu duplizieren. |
| Cover | Referenz auf einen eigenen verschlüsselten PNG-/JPEG-/WebP-Block mit Alternativtext. Das Coverbild steckt nicht bei jedem Kapitel-Save erneut im Manifest. |

Zyklen, fehlende Eltern/Statuswerte, Szene als Elternknoten, übermäßige Tiefe, doppelte Positionen und unbekannte Schema-/Modellfelder werden vor dem Commit abgewiesen. Unbekannte Referenztypen dürfen nicht durch eine ältere App aus der Blockbereinigung entfernt werden. Untitulierte Kapitel/Szenen bleiben speicherbar; „Unbenannt …“ ist nur eine Navigationsbeschriftung, kein heimlich eingefügter Manuskripttext. Statusbezeichnungen und Farben sind anpassbar. Wortzahlen für Kapitelübersichten schließen zugehörige Szenen ein; Editorstatistiken beziehen sich auf den gerade geöffneten Text.

## Dateistruktur und Schlüssel

- Windows: `sealed-workspace/workspace.sealed` enthält den Tresor; `book-blocks/<Projekt-UUID>/manifest.sealed` und `<Block-UUID>.sealed` enthalten Buchdaten.
- Android: dieselben logischen Dateien unter `no_backup/workspace.sealed` und `no_backup/books/<Projekt-UUID>/…`. Native Atomics und die bestehenden Backup-/Bildschirmschutzregeln bleiben erhalten. Keine zusätzliche Android-Berechtigung.
- Browser-Demo: der Root-Tresor bleibt als Ciphertext in LocalStorage; Buchblöcke liegen als Ciphertext in IndexedDB. Die separate Metadatenverwaltung enthält nur UUIDs und Zeitpunkte, keine Titel oder Vorschauen. DB-Version 1→2 ergänzt ausschließlich einen Projektindex.

Der Root-Tresor behält Argon2id (64 MiB, drei Iterationen) und AES-256-GCM. Payload-Version 1/2 bleibt lesbar; Buchreferenzen benötigen Version 3. Bestehende Dokumentdateien werden nicht umgestellt. Ältere Apps müssen den neuen Tresor ablehnen, statt Buchreferenzen zu verwerfen.

Jedes Buch erhält einen kryptografisch zufälligen AES-256-Schlüssel. Er liegt verschlüsselt im Root-Tresor, niemals in einer eigenständigen Klartextdatei. Jeder Block hat eine frische zufällige 96-Bit-Nonce. AEAD bindet Formatversion, Projekt-ID und Block-ID; vertauschte, beschädigte oder fremde Blöcke werden abgewiesen. Es gibt keine eigene Chiffre, keinen Mastercode und keine erneute Kennwortableitung pro Tastendruck. Eine Root-Kennwortänderung benötigt erneute Authentifizierung und verändert die Buchinhalte nicht unnötig.

## Atomarer Commit, konkurrierende Zugriffe und Recovery

1. Nur der ausgewählte Kapiteltext wird geladen und bearbeitet.
2. Ein neuer Dokumentstand wird als neuer verschlüsselter Block geschrieben. Der alte Block bleibt bestehen.
3. Ein kleines, ebenfalls verschlüsseltes Manifest referenziert den neuen Stand.
4. Der Speicheradapter ersetzt das Manifest atomar nur bei unverändertem vorherigen Ciphertext (Compare-and-Swap). Er prüft die Existenz sämtlicher benötigter Blöcke innerhalb derselben Speicher-Sperre/IDB-Transaktion. Fehlende temporäre Blöcke oder konkurrierende Saves erzeugen einen Fehler und keinen ungültigen Commit.
5. Erst nach bestätigtem Commit wird der In-Memory-Stand ersetzt. Fehler lassen den letzten erfolgreichen Manifeststand unverändert.

Auch der Root-Tresor verwendet auf den Produktionsadaptern einen geprüften Versionswechsel. Ein veraltetes Fenster darf neue Buchreferenzen eines anderen Fensters nicht überschreiben. Windows nutzt die vorhandene Main-Prozess-Queue/atomare Dateioperation, Android eine statische Prozesssperre und AtomicFile, Browser Web Locks bzw. IndexedDB-Transaktionen. Nicht zusammenpassende Desktop-Bridge und Renderer werden abgewiesen; es gibt keinen stillen Wechsel in einen anderen Speicher.

Die Bereinigung unbenutzter Kapitelblöcke ist an das aktuelle Manifest gebunden, behält alle aktuellen/gelöschten Einträge und Sicherungspunkte und entfernt höchstens 200 alte unreferenzierte Blöcke pro Durchlauf. Neue Commits prüfen ihre Blockreferenzen atomar erneut, damit auch eine zwischenzeitliche Bereinigung niemals ein Manifest mit fehlenden Blöcken bestätigt. Verwaiste, nicht im aktuellen Root-Tresor registrierte Projekt-Namensräume werden erst nach 24 Stunden und mit Root-Versionsprüfung bereinigt; aktive Imports sind ausgenommen. Unbekannte Dateien bleiben erhalten. Dies betrifft ausschließlich Writely-eigene interne Dateien, keine Explorer-Originale.

## Backup und Austausch

Ohne Bücher bleibt das bisherige verschlüsselte `.writely`-Tresorbackup erhalten. Mit Büchern enthält `WritelyVaultBundle` den verschlüsselten Root-Tresor und alle referenzierten verschlüsselten Kapitel-/Cover-/Historienblöcke. Projektschlüssel werden nicht außerhalb des verschlüsselten Root-Payloads exportiert. Ein allein kopiertes `workspace.sealed` ist dann kein vollständiges Bücherbackup.

Import authentifiziert und validiert das gesamte Projekt vor dem ersten Zielschreibvorgang. Er vergibt neue Projekt-IDs und Schlüssel und verschlüsselt die Blöcke neu, bevor der zusammengeführte Root-Tresor committed wird. Quellen und bestehende Projekte bleiben erhalten. Fehler räumen lediglich neu gestagte Daten auf. Papierkorb und Sicherungspunkte bleiben zugeordnet; keine teilweise erfolgreiche Bibliothekswiederherstellung.

Die bisherige Atomik schützt bestätigte Speicherstände. Ein Strom-/Prozessabbruch vor dem Commit kann letzte noch ungespeicherte Eingaben verlieren; unvollständige Kapitel werden aber nicht als leere Dokumente übernommen. Desktop-Schließen und Android-Hintergrundsperre fordern den aktuellen Editorstand an, bevor die Sitzung geschlossen wird. Browser-Unload ist weiterhin nur best effort.

## Aktuelle Grenzen

- Gesamttresor für bisherige einzelne Dokumente bleibt bestehen; es gibt keine riskante automatische Vollmigration. Bücher nutzen bereits einzelne Kapitelblöcke.
- Höchstens 100 Buchprojekte pro Tresor, 5.000 Gliederungseinträge pro Buch, Tiefe 50, fünf Kapitel-Sicherungspunkte; höchstens 16 MiB Klartext pro Block/Manifest und 90 MiB pro vollständiger Transferdatei. Bilder im Kapitel bleiben im normalen Dokumentmodell eingebettet; allgemeine Asset-Deduplizierung folgt separat.
- Der gesamte Tresor schützt die Bücher. Individuelle Projektkennwörter, Recovery-Key und Keystore-Biometrie sind nicht durch neue Attrappendialoge vorgetäuscht.
- Gesperrte UI, Bilder und Projektzustände werden entfernt; Byte-Schlüssel werden nach abgeschlossenen Writes verworfen. Eine vollständige deterministische Löschung sämtlicher JavaScript-/Engine-Speicherkopien ist nicht garantiert. Dateigrößen, Anzahl und Änderungszeiten werden nicht verborgen; ein kompromittiertes Gerät ist kein abgedecktes Schutzmodell.
- Binder virtualisiert die sichtbaren Reihen; Karten und Gliederung laden begrenzte Mengen. Das ist noch keine Virtualisierung des Textlayouts und keine automatische Pagination.
- Suche, Plot, Story-Bible, globaler Buchdesigner und publizierender Gesamtexport sind eigene Meilensteine. Planungstexte werden nicht als Buchinhalt behandelt.
