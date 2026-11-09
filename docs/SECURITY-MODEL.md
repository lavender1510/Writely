# Sicherheitsmodell des verschlüsselten Tresors (Prototyp 1)

## Was tatsächlich geschützt wird

Ein Tresor ist ein eigener, atomar gespeicherter Arbeitsbereich. Dokumenttexte,
Notentexte, eingebettete Bilder, Formatvorlagen, Layouts, Titel, Ordnerhierarchie,
Anheftungen, Papierkorb und bis zu fünf frühere Fassungen je Dokument liegen
gemeinsam **innerhalb** des authentifizierten Ciphertexts. Die Bridge erhält bei
normalen Speichervorgängen nur den fertigen Umschlag. Es gibt keinen Klartext-
Suchindex, keine separaten Vorschaudateien und keinen Aufruf des alten LocalStore.
Suche und Vorschau entstehen ausschließlich während einer entsperrten Sitzung.

Windows: `userData/sealed-workspace/workspace.sealed`, Dateimodus 0600, eindeutige
temporäre **verschlüsselte** Datei, Dateisystem-Sync und atomarer Rename mit
begrenzten Wiederholungen bei Windows-Dateisperren. Unterbrochene temporäre
Schreibdateien werden beim nächsten Lesen bereinigt. Android: `noBackupFilesDir`,
`AtomicFile` mit Rückfall auf die letzte erfolgreiche Datei. Android-Systembackups
sind deaktiviert. Kein externer Speicherzugriff ohne System-Dateiauswahl; keine
Internetberechtigung. FLAG_SECURE schützt die Android-Fensteransicht vor normalen
Screenshots/Task-Vorschauen. Das ersetzt keinen Schutz eines kompromittierten OS.

**Bestehende Windows-Bibliothek, Recovery und Explorer-Dateien bleiben in ihrem
bisherigen Klartextformat.** Der Tresor markiert sie nicht als geschützt. Beim
Import bleibt die vom Nutzer ausgewählte Quelldatei erhalten. Wer diese Kopie
nicht behalten möchte, muss sie selbst verwalten. Bereits vorhandene Backups,
SSD-Blöcke, Auslagerungsdateien und OS-Sicherungen können nicht rückwirkend durch
einen App-Dialog sicher gelöscht werden.

## Interoperables Dateiformat

JSON-Umschlag `format: WritelySealed`, `version: 1`. Unverschlüsselt sichtbar sind
nur Formatversion, zufällige Tresor-ID, KDF-Parameter, Salt, Nonces, umschlossener
Schlüssel und Ciphertext. Die Länge und Dateisystem-Zeitstempel bleiben sichtbar.
Der verschlüsselte Payload trägt `format: WritelyVault`, `version: 1`, Ordner und
Dokumentdatensätze. Darin bleiben die alten Dokumentversionen 1/2 lesbar; die
bestehende explizite Migration nach Version 2 wird wiederverwendet.

1. Zufälliger Datenschlüssel: 32 Bytes aus `crypto.getRandomValues`.
2. Kennwort exakt als UTF-8, **ohne** Normalisierung/Trimming; beim Einrichten
   mindestens 12 Zeichen, maximal 1024 UTF-8-Bytes.
3. Argon2id v1.3 (Version 19), 65536 KiB, drei Durchläufe, Parallelität 1,
   Ausgabelänge 32 Bytes; unabhängiger zufälliger 32-Byte-Salt. `hash-wasm` 4.13.0,
   MIT. Keine selbst entwickelte KDF. Im Renderer läuft sie in einem Worker.
4. Abgeleiteter Schlüssel verschlüsselt den Datenschlüssel mit AES-256-GCM,
   zufälliger 12-Byte-Nonce und 128-Bit-Tag. Der Tag ist am Ciphertext angehängt.
5. Datenschlüssel verschlüsselt UTF-8-JSON mit AES-256-GCM, eigener zufälliger
   12-Byte-Nonce und 128-Bit-Tag. Jede Speicherung erzeugt eine neue Nonce.
6. Binärfelder verwenden Standard-Base64 mit Padding. `id` ist eine zufällige UUID.

AAD ist UTF-8 von `JSON.stringify` einer festen Array-Struktur:

```
["WritelySealed",1,id,"content"]
["WritelySealed",1,id,"key",KDF,saltBase64]
```

Dabei wird KDF stets in dieser Schlüsselreihenfolge serialisiert:
`name`, `version`, `memoryKiB`, `iterations`, `parallelism`. Unbekannte Versionen
und abweichende KDF-Parameter werden **vor** einer Ableitung abgewiesen, damit
eine manipulierte Datei keinen beliebigen Speicher-/CPU-Aufwand erzwingt.
Inhalt und Schlüsselumschlag sind an die gleiche zufällige ID gebunden.

Kennwortwechsel authentifiziert das alte Kennwort und den Inhalt erneut. Danach
wird nur der Datenschlüssel mit neuem Salt/neuer Nonce umschlossen. Der
Inhalts-Ciphertext bleibt gleich. Alte exportierte Backups behalten ihr altes
Kennwort; ein Kennwortwechsel kann frühere Kopien nicht widerrufen.
Wer den Datenschlüssel aus einem alten Backup bereits kennt, kann auch spätere
mit demselben Datenschlüssel erzeugte Zustände entschlüsseln. Reines Umschließen
ist keine Schlüsselrotation nach einem kompromittierten Schlüssel.

## Sperre, Fehler und Export

Standard: nach fünf Minuten ohne Eingabe und beim Hintergrundwechsel sperren.
Konfigurierbar: 0/1/5/15/30 Minuten und Hintergrundsperre. Beenden verwirft immer
die Sitzung. Die UI entfernt Editor, Dialoge, Tabs, Vorschauen und Suchresultate
sofort; bereits gestartete Schreibtransaktionen werden beendet, dann wird der
Schlüsselbytespeicher überschrieben und der KDF-Worker beendet. Entsperren und
Hintergrundwechsel werden durch eine Sitzungsgeneration gegeneinander abgesichert.
Für JavaScript-Strings, WebView, Garbage Collector und OS-RAM ist eine perfekte
Speicherlöschung nicht nachweisbar. Ein kompromittierter Renderer kann Inhalte
einer **entsperrten** Sitzung lesen. Es besteht keine externe Sicherheitsprüfung.

Desktop-Schließen wartet über eine eigene Preload-Bestätigung auf den aktuellen
verschlüsselten Stand. Ein Fehler oder Timeout verhindert das normale Schließen.
Harter Prozessabbruch kann letzte, noch nicht bestätigte Eingaben verlieren; er
erzeugt keinen Klartext-Recovery-Pfad. Speichern ersetzt den In-Memory-Stand erst
nach erfolgreichem Commit. Gerätestromausfall und defekte Datenträger können
weiterhin Backups erforderlich machen.

Tresor-Backups bleiben verschlüsselt und enthalten auch Papierkorb und Historie.
Import authentifiziert und validiert die komplette Quelle zuerst und führt dann
mit neuen IDs zusammen; bestehende Dokumente werden nicht überschrieben.
Klartext-Export erfordert eine entsperrte Sitzung und explizite Bestätigung. Unter
Windows bestätigt zusätzlich der Hauptprozess den Verlust des Schutzes. `.writely`
bleibt beim Klartext-Export das komplette verlustfreie Dokumentformat; Office/PDF
werden im Tresor noch nicht angeboten, um keine temporären Klartextdateien der
bisherigen Konverter zu erzeugen.

## Noch nicht implementiert

Selektive Kennwörter für einzelne alte Dokumente/Notizen, unabhängig geschützte
Unterordner, Klartextmigration ganzer bestehender Bibliotheken, Schutz entfernen,
Recovery-Key und Android-Keystore/Biometrie. Der vollständige Tresor verwendet
einen gemeinsamen Schlüsselbereich: Verschieben zwischen seinen Unterordnern
ändert ausschließlich verschlüsselte Metadaten. Ein Verschieben nach außerhalb
wird nicht angeboten; nur der ausdrücklich bestätigte Klartext-Export existiert.
Kein Masterkennwort, kein versteckter Wiederherstellungsschlüssel.

## Prüfnachweise

`tests/fixtures/sealed-v1.writely` ist ein öffentlicher Interoperabilitätsvektor,
Kennwort `Writely Testvektor Grüße 2026`. Er enthält Text mit Umlauten/Emoji,
Fettformatierung, Tabelle, PNG und Fußnote. Das ist kein geheimer Nutzerdatensatz.
Node erzeugte den Umschlag; Chromium entschlüsselt, bearbeitet und speichert ihn;
Node entschlüsselt das Ergebnis erneut. Die Android-Instrumentierung verwendet
denselben Vektor im echten WebView. Zusätzlich wird Argon2id-WASM gegen die
unabhängige OpenSSL-Implementierung in Node geprüft. Tests sind kein Audit.
