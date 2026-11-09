# Android und gemeinsamer Kern – Entwicklungsstand

Dies ist ein schrittweiser Prototyp auf Basis von Writely 0.4, kein vollständiger
Ersatz der Windows-App und kein veröffentlichter Android-Release. Windows behält
seinen bisherigen Editor, Konverter, Druckpfad und seine lokale Bibliothek.

## Struktur

| Ort | Zuständigkeit |
| --- | --- |
| `core/types.ts`, `document.ts` | gemeinsames Dokumentmodell, Styles, Statistik, Text, Outline, Font-Fallback |
| `core/validation.mjs`, `document-schema.mjs`, `layout.mjs` | bestehender strenger Validator, Migration, Verweise und Layout ohne Node |
| `core/crypto.ts`, `vault.ts` | gemeinsamer versionierter Umschlag, Authentifizierung und atomare Tresor-Transaktionen |
| `core/platform.ts` | Speicher-, Dateiauswahl-, Repository- und Lifecycle-Verträge |
| `electron/` | bestehende Konverter und Desktop-Dienste; neue ausschließlich verschlüsselte Ablage |
| `src/editor-extensions.ts` | derselbe vollständige Tiptap-Knotensatz für beide Oberflächen |
| `src/SecureWorkspace.tsx`, `SecureEditor.tsx` | getrennte Touch-Oberfläche, Dokument-Tabs und verschlüsselte Bibliothek |
| `src/secure-platform.ts`, `crypto-worker-client.ts` | Plattformadapter und KDF-Worker |
| `android/` | Capacitor-8-/Java-21-Androidprojekt mit nativer SAF-/AtomicFile-Bridge |

Electron-Dateien für Validator/Layout/Migration und `src/document.ts` sind kleine
kompatible Weiterleitungen. Es gibt genau eine Implementierung dieser Kernlogik.
Node-Dateisystem, Pandoc und Electron werden nicht in Android importiert.

## Funktionsstand

| Funktion | Windows-Haupteditor | Tresor Windows / Android |
| --- | --- | --- |
| Bestehende Dokumente, Layouts, Tabellen, Bilder | unverändert verfügbar | gemeinsames Schema, gleicher Knotensatz |
| Verschlüsselung und verschlüsselte Backups | eigener Tresor-Einstieg | implementiert, einschließlich Ordnern und Historie |
| Mehrere offene Dokumente | bisher einzelner Editor | Dokument-Tabs |
| Bibliothek / Papierkorb / Wiederherstellen | vorhanden | verschlüsselt vorhanden |
| Fett/Kursiv/Unterstrichen, Überschriften, Listen | vorhanden | vorhanden |
| Schriftfamilie/-größe/-farbe, Ausrichtung | vorhanden | vorhanden; mobil nur lokale/freie Familien |
| Tabellen und eingebettete Bilder | vorhanden | Einfügen und Bearbeiten mit gemeinsamem Tiptap-Schema |
| Undo/Redo, Live-Suche/Ersetzen, Lesemodus, Statistik | vorhanden | vorhanden |
| Auto-Save und Neustart | vorhanden | eine Sekunde nach Änderung, verschlüsselt |
| Writely / TXT / Markdown / HTML importieren | vorhanden | vorhanden; HTML/MD nur grundlegende Struktur |
| `.writely` Klartext exportieren | vorhanden | nach expliziter Bestätigung |
| Verschlüsselten Tresor austauschen | neuer Einstieg | vorhandene Bibliothek wird beim Import ergänzt |
| DOCX/ODT/RTF/EPUB/PDF, Druck | bestehende Desktop-Konverter | bewusst noch nicht angeboten |
| Offline-Rechtschreibung DE/EN | vorhanden | noch kein Android-Adapter |
| Vorlagen / Covers / Seitengestaltung | vorhanden | vorhandene Dokumentdaten bleiben erhalten; eigene mobile Dialoge fehlen |
| Biometrie, Sharing, Öffnen-aus-anderen-Apps | entfällt / bisheriger Stand | noch nicht implementiert |

Die mobile Oberfläche passt sich an Smartphone/Tablet und Hoch-/Querformat an,
nutzt lokale Fonts, Hell/Dunkel/System und die vorhandenen violetten Markenfarben.
Die Werkzeugleiste sitzt im Prototyp oben; die geplante untere, IME-abhängige Leiste
folgt nach Gerätetests. Eigene Hardwarekürzel: Strg+S speichern,
Strg+F suchen, Strg+Umschalt+L sperren; Tiptap stellt Format-/Undo-Kürzel bereit.

## Lokaler Build

Voraussetzungen: Node 24, JDK 21, Android SDK Plattform 36 und Build Tools 35.0.0
(Standard von Android Gradle Plugin 8.13).
`ANDROID_HOME` zeigt auf das SDK; Lizenzen mit `sdkmanager --licenses` akzeptieren.

```
npm ci
npm run android:sync
cd android
./gradlew --no-daemon assembleDebug assembleDebugAndroidTest
./gradlew --no-daemon connectedDebugAndroidTest
```

Unter Windows `gradlew.bat` verwenden. `npm run android:build` ist ein Komfortbefehl
für Unix. APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Debug-Signatur
ist nur für Entwicklung; kein Play-Store-Paket, kein reproduzierbar identischer
Signaturschlüssel zwischen fremden Rechnern. Der Buildprozess selbst ist durch
Lockfile, Gradle Wrapper und Versionen nachvollziehbar.

Die GitHub-Action `Android prototype build and WebView checks` baut Debug-APK und
Instrumentierung und führt sie auf API-35-Emulator aus. Testergebnisse/APK bleiben
Actions-Artefakte. Kein Release-/Play-Publishing-Schritt vorhanden.

Browser-Probe ohne Android: `npm run dev`, dann `/?mobile=1`. Sie prüft responsive
UI und Kryptografie, ersetzt aber keine Prüfung von Android-IME, SAF, Keystore,
App-Lifecycle oder nativer Textauswahl. Der Browseradapter speichert nur den
Ciphertext in localStorage und eignet sich für Tests, nicht als Desktop-Ersatz.

## Austausch nachvollziehen

1. Windows: Tresor erstellen, Dokument mit Text, Tabelle und Bild anlegen.
2. „Backup“ als `Writely-Tresor.writely` exportieren. Die Datei ist verschlüsselt.
3. Android: eigenen Tresor einrichten; „Importieren“, Backup über SAF auswählen.
4. Ggf. Ziel-Tresor nach dem Systemdialog erneut entsperren, dann Quellkennwort
   eingeben. Der Import ergänzt mit neuen Dokument- und Ordner-IDs.
5. Bearbeiten, erfolgreichen Speicherstatus abwarten und verschlüsseltes Backup
   zurück nach Windows übertragen/importieren. In umgekehrter Richtung genauso.

Beim Importieren wird eine Quelle nicht gelöscht. Beide Dateien bleiben unter
ihrem jeweiligen Kennwort geschützt. Ein Austausch ist keine Synchronisation;
Zusammenführen erzeugt bewusst unabhängige Kopien, keine Konfliktauflösung.

## Grenzen und nächster Entwicklungspfad

Der Tresor verschlüsselt den Gesamtzustand neu, maximal 64 MiB Klartext und 1000
Dokumente/Ordner. Das ist kein Nachweis für Hunderte große bebilderte Dokumente.
Historie: maximal fünf Fassungen, automatische Momentaufnahme höchstens einmal
pro Minute; UI kann aktuell die letzte ältere Version wiederherstellen. Für
größere Bibliotheken folgen verschlüsselte Objektablage/Bild-Deduplizierung und
ein abbrechbarer Suchworker statt der momentan synchronen Tresor-Volltextsuche.

Als Nächstes: vollständige Android-Gerätetestmatrix mit mehreren IMEs, SAF-Abbruch
und Prozesswiederherstellung; Versionsvorschau und mobile Vorlagen; individuelles
Schlüsselmodell einschließlich sicherer Migration; Keystore/BiometricPrompt;
Android-Sharing/Datei-Intents; geprüfte DOCX-/PDF-Adapter. Die Desktop-Konverter
werden hierfür nicht unverändert übernommen. WEBP-DOCX-Export im alten
Windows-Konverter bleibt eine bekannte separate Einschränkung.
