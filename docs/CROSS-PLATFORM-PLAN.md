# Windows, Android und verschlüsselter Dokumentkern

## Geprüfte Ausgangslage

Entwicklungsbasis ist Commit `3663733` (Tag `v0.4.0-alpha.1`), nicht der ältere
Main-Stand `df50b68`. PR #1 enthält diese Windows-Weiterentwicklung noch ungemergt.
Dieser Entwicklungsbranch baut darauf auf. Es erfolgt keine Veröffentlichung.

Electron besitzt eine schmale, validierte Preload-Bridge, Sandbox und isolierte
Renderer. React/Tiptap 3 bearbeitet Dokumentversion 2; Version 1 wird explizit
migriert. Der Validator erlaubt nur bekannte Knoten, Attribute, sichere Links und
eingebettete Bilder. Seiteneinstellungen, Verweise und Konverter liegen bislang
unter `electron/`, obwohl ein Teil davon keine Node-Abhängigkeiten braucht.

Die Bibliothek verwendet atomar ersetzte JSON-Indizes und unveränderliche
Dokumentrevisionen. Papierkorb, Dokumenthistorie, lokale Volltextsuche und
Bibliotheks-Backups existieren bereits. Recovery, Vorschauen, Suchcache, Versionen
und Bibliotheksdateien sind bisher **Klartext**. Ein Schloss im bisherigen
Dokumentmenü wäre daher noch kein sicherer Kennwortschutz. Backups schließen die
separate Desktop-Historie bisher nicht ein. Die Oberfläche öffnet nur einen
Editor gleichzeitig. PDF benötigt Chromium; RTF/EPUB Pandoc; diese Abhängigkeiten
sind keine Android-Konverter. Rechtschreibung nutzt lokale Node-Worker und
mitgelieferte Wörterbücher; auf Android muss hierfür ein eigener Adapter folgen.

## Umsetzung und Abhängigkeiten

1. **Gemeinsamer Kern:** vorhandenen strengen Validator, Migration und Layoutlogik
   ohne Verhaltensänderung aus Electron lösen; gemeinsame Typen, Statistik,
   Textsuche und Speicher-/Lifecycle-Verträge definieren. Windows-Regressionen
   nach jeder Änderung prüfen.
2. **Kryptografischer Prototyp:** versionierter AES-256-GCM-Umschlag mit zufälligem
   Datenschlüssel, Argon2id-Kennwortableitung und separat authentifiziertem
   Schlüsselumschlag. Manipulation, falsches Kennwort, Unicode, Passwortwechsel
   und Browser/Node-Interoperabilität testen, bevor UI-Schutz angeboten wird.
3. **Abgeschotteter Tresor:** ein vollständig verschlüsselter Arbeitsbereich mit
   Dokumenten, Ordnern, Papierkorb und Historie in einer authentifizierten Datei.
   Keine Kopplung an bestehende Klartext-Autosaves, Vorschauen oder Suchindizes.
   Atomare verschlüsselte Speicherung und Backup; Sperren entfernt die Sitzung.
   Das ist der sichere Kernumfang; selektive Migration der alten Bibliothek und
   unabhängig verschlüsselte Unterordner verlangen zusätzliche Transaktionen.
4. **Android-Prototyp:** Capacitor mit demselben Kern und Tresor, eigener
   Touch-Oberfläche und Tiptap. Native Dateiauswahl via Storage Access Framework,
   interne App-Speicherung und Lifecycle-Sperre. Zuerst `.writely`, TXT,
   Markdown/HTML; keine vorgetäuschte Office-/PDF-Kompatibilität.
5. **Prüfung und Lieferung:** Unit- und Browser-Interop-Tests, Windows/Electron-
   Regressionen, reproduzierbarer Android-Debug-Build, CI-Artefakte und PR.
   Emulator-/Gerätetests separat von Browser-Tests dokumentieren.

## Risiken und spätere Ausbaustufen

Eine vollständige Ordner-Verschlüsselungsmigration der bestehenden Bibliothek
darf keine Klartextkopien hinterlassen. Sichere Löschung alter SSD-Blöcke ist
softwareseitig nicht garantierbar. Deshalb zunächst ein eigener Tresor; alte
Dateien werden weder stillschweigend als geschützt markiert noch gelöscht.
Selektive Dokumentkennwörter, mehrere Schlüsselhierarchien, Recovery-Key und
Keystore/BiometricPrompt folgen erst mit gesonderten Integrationsprüfungen.
Biometrie wird nicht durch ein unsicher gespeichertes Kennwort simuliert.

Ein verschlüsselter Gesamtzustand ist einfach atomar prüfbar, skaliert jedoch
nicht unbegrenzt. Der Prototyp erhält Größen- und Historienlimits. Eine spätere
Objektablage kann Medien deduplizieren, benötigt dafür eine eigene konsistente
Transaktions- und Schlüsselverwaltung. Android-IME, native Cursorsteuerung und
echtes App-Pause-Verhalten benötigen Emulator-/Geräteprüfungen; Desktop-
Chromium allein weist diese Eigenschaften nicht nach.
