# Vollständiger Paritätsabgleich und Entwicklungsplan

Ausgangsanalyse: Android `a4f7505`, Windows 0.4 `3663733`, main `df50b68`. PR #2 basiert auf PR #1; beide offen. Neuer Branch basiert auf dem Android-Stand, der bereits sämtliche 0.4-Änderungen enthält. Kein Release.

Legende: **V** vollständig im genannten unterstützten Umfang vorhanden; **T** teilweise (z. B. Modell erhält Daten, UI fehlt); **S** sichtbar ohne Funktion; **N** nicht vorhanden; **B** betriebssystemspezifisch. Diese Eingangsmatrix beschreibt den Code vor dem Update, keine pauschale Testfreigabe. Funktionsnachweise werden separat mit tatsächlichen Bedienaktionen geführt. Scheinbar vorhandene SmartArt sind Rastergrafiken, Noten sind Textnoten, TOC-Seitenzahlen werden nicht behauptet.

| Funktion | Windows | Android vorher | Android nach Update | Umsetzung / technische Abweichung |
|---|---|---|---|---|
| Fett, kursiv, unterstrichen | V | V | V | Regression |
| Durchgestrichen, Hoch-/Tiefstellung | V | N | V | gemeinsame Marks bedienen |
| Textmarker | V | N | V | Highlight-Werkzeug |
| Schriftfamilie/-größe/-farbe | V | T | T | Auswahlwerte und Styles |
| Absatzstyles, vererbte Styles | V | T | T | Style-Auswahl/-Bearbeitung |
| Zeichenstyles (benannte Vorlagen) | N | N | N | beide ohne separates Zeichenstylemodell |
| Formatierung entfernen | V | N | V | unsetAllMarks/clearNodes |
| Überschriften 1–6, Absatz | V | V | V | Regression |
| Zitat, Codeblock | V | N | V | gemeinsame Commands |
| Listen, Nummerierungen | V | V | V | Regression |
| Listeneinzug | T | N | V | sink/liftListItem |
| Freie Absatzeinzüge/-abstände | N | N | N | neue Schemaattribute nötig |
| Zeilenabstand | V | N | V | Style-System anbinden |
| Ausrichtung inkl. Blocksatz | V | T | V | Blocksatz ergänzen |
| Trennlinie | V | N | V | gemeinsamer Command |
| Seiten-/Abschnitt-/Spaltenumbruch | V | T | V | Bedienung und Layoutdialog |
| Undo/Redo, Suche/Ersetzen/Regex | V | V | V | Regression mit Format-Runs |
| Zwischenablage, Alles auswählen | T | T | T | native Auswahl; Berechtigungen beachten |
| Gliederung, Statistik, Fokusmodus | V | T | T | Gliederung und Fokus |
| Typewriter-Scrolling | V | N | N | offene Komfortabweichung |
| Lesemodus | T | V | V | Regression |
| Papierformate und benutzerdefinierte Maße | V | T | V | LayoutPanel wiederverwenden |
| Ränder, Bundsteg, Spiegelränder, Einheiten | V | T | V | LayoutPanel |
| Spalten, Abstand, Trennlinie | V | T | V | LayoutPanel |
| Hintergrund, Rahmen, Wasserzeichen | V | T | V | LayoutPanel |
| Kopf-/Fußzeile und Nummerierungsoptionen | V | T | V | LayoutPanel |
| Abschnittslayouts, Seitenbereiche verwalten | V | T | T | LayoutPanel/PageNavigator |
| Automatische Editor-Paginierung | N | N | N | separate Layoutengine; keine falschen Seitenzahlen |
| Geprüfte PDF-/Druckvorschau | V | N | N | Android PrintAdapter und Drucklayout erforderlich |
| Tabellen einfügen | V | T | V | Zeilen-/Spaltenauswahl |
| Zeilen/Spalten anfügen, löschen, kopieren, verschieben | V | N | V | TableTools |
| Zellen verbinden/trennen, Kopfzeilen | V | N | V | TableTools |
| Zellfarbe/-rahmen/-abstände | T | N | T | vorhandene Tabellenstile anbinden |
| Bild aus Datei/Galerie | V | V | V | Android Systempicker testen |
| Bild aus Zwischenablage | V | T | T | native Einfügepfade/Gerätetest offen |
| Bild skalieren, crop, drehen, spiegeln | V | T | V | ImageTools |
| Helligkeit/Kontrast, Rahmen, Alttext, Umfluss | V | T | V | ImageTools |
| Formen, Prozess, Hierarchie, Liste, Zyklus, Vergleich, Zeitachse | T | T | T | InsertPanel; Raster mit editierbaren Quelldaten |
| Balken/Linie/Kreis/Fläche/Punkte | T | T | T | InsertPanel; Raster, keine Office-Vektorobjekte |
| Bestehende Grafik erneut bearbeiten | T | N | V | Quelldaten ersetzen statt Bild duplizieren |
| Link, interner Anker | V | T | V | Linkdialog; vorhandene Anker erhalten |
| Eigenständige Querverweisfelder | N | N | N | beide ohne vollständiges Feldmodell |
| Dynamisches Inhaltsverzeichnis | T | T | T | TOC einfügen; keine verifizierten Seitenzahlen |
| Fuß-/Endnoten bearbeiten und nummerieren | T | T | T | NotesPanel; Textnoten, keine Rich-Text-Noten |
| Alle/zuletzt/angeheftete Dokumente | V | T | T | Bibliotheksansichten |
| Ordner erstellen/verschachteln/umbenennen/verschieben | V | T | V | verschlüsselte Transaktionen |
| Dokument umbenennen/verschieben/duplizieren | V | T | T | verschlüsselte Transaktionen |
| Papierkorb, Wiederherstellen, bestätigtes Löschen | V | V | V | Regression |
| Sortierung und Filter | V | T | V | Auswahl und Titel/Datum |
| Volltextsuche | V | T | T | Tresor-Suche derzeit synchron, Skalierung offen |
| 20 Vorlagen, Themes, Cover | V | N | V | gemeinsamer Katalog/Design |
| Eigene Vorlagen und Stylesets | V | N | T | ausschließlich im Tresor speichern |
| Versionsvorschau und frei gewählte Wiederherstellung | V | T | T | Historienauswahl statt nur letzter Version |
| Bibliotheks-Backup und Merge-Import | T | V | V | Windows-Backup ohne separate Historie; Tresor inkl. Historie |
| Writely Import/Export | V | V | V | Roundtrip |
| TXT/Markdown/HTML Import | T | T | T | grundlegende Semantik; komplexe CSS-Layouts offen |
| TXT/Markdown/HTML Export | T | N | T | portable Exporter mit Verlusthinweisen |
| DOCX Import/Export | T | N | T | Mammoth/docx browserfähig; Node-/ZIP-/Layoutpfade noch portieren |
| ODT Import/Export | T | N | T | nativen ODF-ZIP-Adapter portieren, kein Pandoc auf Android |
| RTF Import/Export | T | N | N | Pandoc-Ersatz mit echtem RTF-Parser erforderlich |
| EPUB Import/Export | T | N | N | OPF/Nav/ZIP-Adapter erforderlich |
| PDF-Erstellung, Android Print Framework | B | N | N | nativer PrintDocumentAdapter mit Abschnittslayout erforderlich |
| Dateikonverter und Batch | T | N | N | nur nach geprüften mobilen Formatadaptern |
| Offline-Rechtschreibung DE/EN, Vorschläge, Benutzerwörterbuch | V | N | N | nspell-Node-Worker durch Browserworker ersetzen; Wörterbuch bleibt geschützt |
| AutoKorrektur/Thesaurus/Silbentrennung | N | N | N | keine entsprechenden Windows-Dienste |
| Tresor, Argon2id/AES-GCM, rekey, automatische Sperre | V | V | V | Sicherheit unverändert testen |
| Einzelne Dokument-/Notiz-/Ordnerkennwörter | N | N | N | separate Schlüsselhierarchie und transaktionale Migration erforderlich |
| Keystore/Biometrie, Recovery-Key | N | N | N | native authentifizierte Key-Wrapping-Integration; keine UI-Attrappe |
| Auto-Save und Crash-Recovery | V | V | V | verschlüsselte Sitzung und Prozessneustart |
| SAF/System-Dateiauswahl | B | V | V | Regression |
| Explorer-/Android-Datei-Intents, Sharing | B | N | N | native Uri-Berechtigungen und Lifecycle-Übergabe erforderlich |
| Fenster/Monitore, Systemfonts, Screenshot | B | B | B | Windows-spezifisch, mobile Entsprechung separat |
| Zurück-Geste | B | T | T | Editor→Bibliothek, Dialog→Editor |
| Hell/Dunkel/System, Tablets, Tastatur | T | T | T | mobile Dialoggrößen, Kontextwerkzeuge, native Eingaben |
| Kommentare/Änderungsverfolgung/Kollaboration | N | N | N | keine funktionsfähige Windows-Basis |
| Makros/OCR/Formeleditor | N | N | N | keine entsprechende Windows-Implementierung |

## Reihenfolge und Sicherheitsgrenzen

1. Gemeinsame Editorwerkzeuge, Layout, Tabellen, Bilder/Grafiken, Notes/TOC, Navigation und Design wiederverwenden. Editoränderungen durch ProseMirror-Transaktionen mit Undo/Redo. Android-Werkzeugleiste unten, Dialoge für Touch und Tablet.
2. Bibliothek und eigene Vorlagen ausschließlich durch verschlüsselte Tresortransaktionen; Design darf niemals die alte Klartextbibliothek aufrufen. Vorlagen und Metadaten im bestehenden Envelope erhalten.
3. Portable Text-/HTML-/Markdown-Ausgabe mit ausdrücklichem Verlusthinweis. Office/PDF benötigen echte Adapter und Layoutnachweise; bis dahin offen und kein scheinbar funktionierender Menüeintrag.
4. Reproduzierbare UI-, Speicher-, Layout-/Noten-/Grafik-Roundtrips, Unit- und Desktop-Regressionen; Android-APK und API-35-Instrumentierung in CI.

Individuelle Schlüsselbereiche/Biometrie, skalierende verschlüsselte Objektablage, native Print-/Officeadapter, Rechtschreibworker und Datei-Intents bleiben konkrete technische Arbeitspakete. Der gemeinsame Tresor ersetzt diese Funktionen nicht. Bestehende geschützte Daten werden nicht in Klartext migriert. Unbekannte Dokumentelemente werden weiterhin vor dem Öffnen abgewiesen, statt still entfernt.

## Tatsächlich ergänzter Stand 0.5.0-alpha.2

- Text: Strike, Hoch-/Tiefstellung, Textmarker, Formatierung entfernen, Links, Zitat/Code, Listeneinzug, Blocksatz, benannte Absatzstyles und Style-Zeilenabstand. Gemeinsame Tiptap-Commands, keine zweite Formatierungsengine.
- Layout/Table/Image/Insert/Notes/Design/PageNavigator werden gemeinsam benutzt. Alle Layoutdialog-Optionen sind bedienbar; automatische Editor-Paginierung und Android-Druckvorschau bleiben offen. Grafiken lassen sich anhand ihrer Quelldaten bearbeiten; dabei wurde ein Duplikationsfehler auch für Windows behoben.
- Verschlüsselte eigene Vorlagen/Stylesets, 20 eingebaute Vorlagen, Covers/Themes, Ordner umbenennen/verschieben, Dokumente duplizieren, Ansichten/Sortierung und Versionsauswahl. Zuletzt bearbeitet ist ausdrücklich noch keine persistente Zuletzt-geöffnet-Liste. Versionsvorschau bleibt eingeschränkt.
- DOCX- und ODT-Export verwenden gemeinsam mit Windows die ausgelagerten Writer mit Buffer-Browseradapter, WebAssembly-SHA-256 und JSZip; nativer SAF überträgt Binärdaten als Base64, niemals als falsch dekodierten UTF-8-Text. Unveränderte Writely-Officepakete werden vollständig über geprüfte Zusatzdaten importiert. Externes DOCX nutzt Mammoth mit deutlicher Verlustwarnung. Externes/verändertes ODT wird verständlich abgewiesen, bis ein semantischer mobiler ODF-Importer vorliegt. Keine vollständige Office-Kompatibilität behauptet.
- TXT-/HTML-Export mit konkreter Verlustbestätigung zusätzlich zum Klartext-Sicherheitshinweis. HTML erhält noch keine originalgetreue Druckgeometrie; dynamische Verzeichnisse sind dort eingeschränkt. RTF/EPUB/PDF/Markdown-Ausgabe bleiben offen.
- Native Zurück-Geste speichert vor Bibliothekswechsel/Beenden. Kleine Displays erhalten eine untere Werkzeugleiste und horizontal zugängliche Kontextbereiche; Tablet benutzt die größere Schreibfläche.

Keystore/Biometrie und einzelne Schlüsselbereiche werden nicht durch einen neuen UI-Schalter simuliert. Die vorhandene Verschlüsselung einschließlich Historie/Backups bleibt unverändert. Der 64-MiB-Gesamttresor und die synchrone Bibliothekssuche haben weiterhin die dokumentierten Skalierungsgrenzen.

Globale Style-/Theme-Metadaten besitzen weiterhin keine vollständige gemeinsame Undo-Historie; normale Text-, Tabellen-, Bild- und Layouttransaktionen verwenden ProseMirror-History. Dies ist keine behauptete Vollparität für Dokumentmetadaten.

## Installation und Grenzen der Debug-Signatur

APK aus dem Artefakt des Android-Workflows herunterladen, auf das Gerät übertragen und die Installation aus dieser Quelle erlauben. Android 7/API 24 ist Mindestversion; die Instrumentierung verwendet API 35. Für den lokalen Build: JDK 21, SDK 36, Build Tools 35.0.0, `npm ci`, `npm run android:sync`, `android/gradlew -p android :app:assembleDebug`.

Vor dem Wechsel von einer älteren Debug-APK ein verschlüsseltes Tresor-Backup außerhalb der App sichern. Verschiedene CI-Runner können unterschiedliche Debug-Zertifikate verwenden; Android verweigert dann ein direktes Update. Die alte App keinesfalls ohne geprüftes externes Backup deinstallieren. Es wird keine automatische Deinstallation/Migration auf Nutzergeräten durchgeführt. Eine stabile Distributionssignatur muss vor einer öffentlichen Veröffentlichung eingerichtet werden.

## Reproduzierbare Funktionsnachweise

- `npm test`: 77 Prüfungen. Neue Tests prüfen echte DOCX-/ODT-XML, native Noten/Abschnitte, Windows-kompatible Fingerprints, Manipulationserkennung sowie verschlüsselte Vorlagen, Ordnerzyklen, Duplikate und Backup-Merge.
- `npm run test:e2e`: 23 Bedienprüfungen. Ergänzt: mobiles A5-Querformat einschließlich Undo und verschlüsseltem Erhalt der Tabelle/Noten; Tabellenzeile einfügen/Undo; dynamisches TOC; vorhandene Fußnote bearbeiten; echtes DOCX herunterladen und prüfen; nach Entfernen privater Zusatzdaten den externen DOCX-Import mit Tabelle/PNG ausführen. Die zusätzlichen drei Paritätsprüfungen bestehen lokal auch mit dem expliziten Notentext-Label.
- `npm run test:desktop` und `npm run test:secure-desktop`: bestehende echte Electron-Prüfungen und vier Tresorprüfungen lokal bestanden. Die Windows-Action wiederholt diese am PR und testet außerdem das gepackte Programm.
- Android: App und Test-APK bauen lokal. Die native Instrumentierung ergänzt die A5-Auswahl; der Host-Roundtrip prüft dieses Layout nach der Android-Bearbeitung. Der abschließende Emulatorlauf wird im PR verlinkt; ein lokaler Build allein gilt nicht als Gerätemessung.

Dies ist kein Nachweis für alle Bildschirmtastaturen, große Medienbibliotheken, sämtliche Dialogoptionen auf echten Tablets oder verlustfreie Fremd-Office-Konvertierung. Offene Zeilen der Matrix bleiben offen und werden nicht durch ein sichtbares Menü als erledigt gezählt.

Aktuelles UI-Redesign, tatsächliche Bedienwege und weiterhin offene Abweichungen: [ANDROID-REDESIGN.md](ANDROID-REDESIGN.md). Insbesondere bleiben echte Pagination, Handschrift/Checkboxschema, mobiler Print/PDF und individuelle Schlüsselbereiche offen.

Weiterentwicklung ab 0.5.0-alpha.4: Gemeinsame Zielordner-Transaktionen, Ordnerdialoge mit Farbe/Symbol/Pin, Breadcrumbs, Mehrfachverschieben und rekursiver Ordnerpapierkorb. Windows- und Android-Bibliothek erhalten dieselben Ordnerinvarianten; Speicheradapter bleiben getrennt. Vollständige Bestandsanalyse, Datenformatänderungen, messbare Tresorgrenzen und Bücher-Meilensteine: [BOOKS-ROADMAP.md](BOOKS-ROADMAP.md). Der Bücher-Modus und echte Pagination werden damit noch nicht als implementiert ausgewiesen.
