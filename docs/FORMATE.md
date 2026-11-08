# Writely – Dateiformate und Kompatibilität

Stand: 8. November 2026. Der Funktionsumfang wird bewusst nach Version getrennt. „Grundlegend“ bedeutet unterstützte Strukturen mit möglichen Layoutverlusten, keinen vollständigen Office-Roundtrip.

## Vorabversion / v0.1

| Format | Import | Export | Konkrete Grenze |
| --- | --- | --- | --- |
| Writely `.writely` | Ja | Ja | Versioniertes UTF-8-JSON mit dem implementierten Editorinhalt; kein Office- oder ZIP-Paket |
| TXT `.txt` | Ja | Ja | Text und Zeilenumbrüche; Formatierung, Bilder und Tabellen gehen beim Export verloren |
| Markdown `.md` | Grundlegend | Grundlegend | Überschriften, Absätze, Listen, Links und einfache Inlineformatierung nach implementiertem Parser; keine verlustfreie Übertragung aller Rich-Text-Strukturen |
| HTML `.html` | Grundlegend | Grundlegend | Unterstützte semantische Elemente; Skripte, aktive Inhalte und fremde CSS-Seitenlayouts gehören nicht zum Dokumentmodell |
| DOCX `.docx` | Grundlegend, Mammoth | Grundlegend, `docx` | Fokus auf Text, Überschriften und unterstützte Formatierungen; keine Garantie für exakte Seitenumbrüche, Kopf-/Fußzeilen, Fußnoten, Kommentare oder Änderungsverfolgung |
| PDF `.pdf` | Geplant | Ja, Desktop | Electron/Chromium-Drucklayout; Ausgabe im Browser-Prototyp oder Entwicklungs-Webfrontend ist nicht identisch mit der nativen Desktop-PDF-API |
| ODT `.odt` | Geplant | Geplant | Separater Adapter und Kompatibilitätskorpus erforderlich |
| RTF `.rtf` | Geplant | Geplant | Separater sicherer Parser/Serializer erforderlich |
| EPUB `.epub` | Geplant | Geplant | OPF, Navigation, XHTML, Bilder und Metadaten noch gesondert umzusetzen |
| DOC `.doc` | Geplant, später | Geplant, später | Binäres Altformat; benötigt einen externen, isolierten Konverter |

Diese Matrix beschreibt die beabsichtigte Grenze der Vorabversion. Für eine konkrete Veröffentlichung sind die Release-Hinweise und die bestandenen Tests maßgeblich. Ein Dateidialog darf nicht den Eindruck erwecken, ein als „geplant“ markiertes Format werde bereits verarbeitet.

## Gemeinsamer Adaptervertrag

Jeder Konverter erhält Bytes plus Optionen und liefert ein strukturiertes Ergebnis:

```ts
interface ConversionWarning {
  code: string;
  message: string;              // deutsch und handlungsorientiert
  severity: 'info' | 'warning' | 'error';
  sourceLocation?: string;
  affectedElementId?: string;
}

interface ImportResult<TDocument> {
  document: TDocument;
  warnings: ConversionWarning[];
  sourceFormat: string;
}

interface ExportResult {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  warnings: ConversionWarning[];
}
```

Dies ist die Ziel-Schnittstelle für alle Adapter. Ein einfacher MVP darf weniger Metadaten liefern; er muss bekannte Einschränkungen dennoch sichtbar machen. Formaterkennung prüft Dateisignatur und Inhalt zusätzlich zur Dateiendung. Eine `.doc` darf nicht als `.docx` interpretiert werden. Fehlende Unterstützung führt beispielsweise zu: „ODT wird in dieser Vorabversion noch nicht unterstützt. Öffne die Datei als DOCX, HTML oder Text.“ Eine fehlgeschlagene Konvertierung darf weder die Quelldatei überschreiben noch ein leeres Dokument als erfolgreichen Import anzeigen.

## DOCX

### v0.1

Mammoth wandelt DOCX semantisch in HTML um; das HTML wird vor der Editorübernahme bereinigt und auf das Editor-Schema reduziert. Der Import rekonstruiert kein pixelgenaues Word-Layout. Das Paket `docx` erzeugt beim Export ein neues Office-Open-XML-Paket aus den tatsächlich abgebildeten Editorstrukturen. Dass eine Bibliothek Fußnoten oder Kommentare unterstützen kann, bedeutet nicht, dass Writely diese bereits verlustfrei übernimmt.

### Ausbau

Ein dedizierter OOXML-Adapter liest/schreibt Beziehungen und relevante Paketbestandteile: Dokument, Absatz-/Zeichen-/Tabellenstyles, Nummerierung, Medien, Themen, Abschnitte, Kopf-/Fußzeilen, Fuß-/Endnoten, Kommentare und Änderungsmarkierungen. Feldcodes und Querverweise benötigen eigene semantische Knoten. Merged Cells, Bildpositionierung und Tabstopps werden mit Referenzdateien geprüft.

Unbekannte XML-Teile dürfen als inaktive Originaldaten erhalten werden, wenn sie sicher sind und ihre Beziehungen unverändert bleiben. Nach betroffenen Änderungen kann eine solche Erhaltung unzuverlässig werden; Writely meldet dies und erfindet keine Treue. Makros werden nicht ausgeführt. Verschlüsselte Dateien benötigen später einen expliziten unterstützten Entschlüsselungsweg.

Qualität: Strukturvergleich vor/nach Import und Export plus Renderingvergleich in Word und LibreOffice. Testkorpus enthält deutsche Typografie, verschachtelte Listen, Tabellen, Bilder, Fußnoten, Kommentare und nachverfolgte Änderungen. Unterstützte Features werden einzeln bewertet; ein pauschaler Prozentwert für „Office-Kompatibilität“ wäre irreführend.

## ODT

Geplanter nativer Adapter für OpenDocument-Textpakete: `mimetype`, `content.xml`, `styles.xml`, `meta.xml`, `settings.xml`, Manifest und Ressourcen. Automatische und benannte Styles bleiben unterscheidbar; Masterseiten, Seitenlayouts und Listenstile werden ins Writely-Modell übersetzt. Tabellen, Bilder, Noten, Kommentare und Änderungsregionen erhalten gesonderte Tests.

ODT und DOCX werden über das gemeinsame Dokumentmodell verbunden. Ein pauschaler Zwischenweg über HTML würde zu viele Stil-, Abschnitts- und Metadateninformationen verlieren. LibreOffice als optionaler Konverter kann später eine begrenzte Notlösung sein; Lizenz, Installation, Startzeit, Isolierung und reproduzierbare Version müssen geklärt sein. „Vollständig unterstützt“ wird erst für einen veröffentlichten Prüfkatalog behauptet.

## PDF

### Export in der Vorabversion

Electron erzeugt die PDF aus der Druckansicht über `webContents.printToPDF`. Der Export muss geladene lokale Bilder und `document.fonts.ready` abwarten. Papiergröße, Ränder und Print-CSS werden ausdrücklich gesetzt. Der Export sollte einen isolierten Dokument-Renderer verwenden, damit Ribbon und Dialoge nicht im Ergebnis erscheinen.

Chromium bettet verwendete Schriften häufig als Teilmengen ein. Das ist mit den konkreten Dateien zu prüfen und ersetzt keine Prüfung der Einbettungsrechte. Explizite PDF-Lesezeichen, frei steuerbare Metadaten, PDF/A und PDF/UA werden für v0.1 nicht zugesichert. Auch korrekte Darstellung im Editor beweist keine identischen Druckumbrüche. Der Test prüft lesbaren Text, Umlaute, Bilddarstellung, Seitengröße und das Ausbleiben abgeschnittener Inhalte.

### Späterer Import

PDF.js oder ein geeigneter isolierter PDF-Dienst extrahiert Textpositionen, Schriften und Bilder. Ein Rekonstruktionsschritt erkennt Zeilen, Absätze und Lesereihenfolge. Spalten, Tabellen, gedrehter Text, Ligaturen und Fußnoten benötigen Heuristiken. Ergebnis ist ein neu aufgebautes Dokument mit Qualitätsbericht. Gescannte PDFs besitzen unter Umständen keinen Text; OCR bleibt eine spätere, getrennte Funktion. Original-PDF und rekonstruierter Inhalt bleiben unterscheidbar.

## Markdown

Das unterstützte Profil wird explizit benannt, zunächst CommonMark-orientierte Grundelemente. Tabellen, Fußnoten und durchgestrichener Text sind Erweiterungen, die jeweils implementiert und geprüft werden müssen. Rich-Text-Formatierung ohne Markdown-Entsprechung führt zu einer Warnung oder einer ausdrücklich gewählten HTML-Erweiterung. Eingebettetes HTML wird nicht als aktiver Inhalt ausgeführt.

Bilder benötigen eine definierte Strategie für lokale Pfade oder einen Exportordner; der Export darf keine nicht existierenden Bilddateien referenzieren. Relative Pfade dürfen beim Import keine beliebigen Dateien außerhalb des freigegebenen Dokumentkontexts lesen.

## HTML

Import: sichere semantische Elemente wie Absätze, Überschriften, Listen, Links, Tabellen und Bilder auf das erlaubte Schema abbilden. Importierte Skripte, `on*`-Attribute, Frames, Formulare und aktive URL-Protokolle entfernen; keine Netzwerkressourcen automatisch laden. Das Editor-Schema ersetzt keine vollständige Sicherheitsbereinigung.

Export: UTF-8, Dokumenttitel, Sprachangabe und semantische Struktur. Für lokale Weitergabe eine in sich geschlossene Datei oder ein nachvollziehbares HTML-plus-Assets-Paket anbieten. Beliebiges Web-CSS, absolute Positionierung und fremde Schriften werden nicht originalgetreu zugesichert.

## RTF

Geplanter Parser mit klarer Größen-/Verschachtelungsgrenze, Unicode-/Codepage-Behandlung, Font-/Farbtabellen, Absätzen, Listen und eingebetteten Bildern. `\uc`/`\u` und ältere Windows-Codepages sind für deutsche Texte ausdrücklich zu testen. Eingebettete Objekte, OLE und aktive Inhalte werden nicht ausgeführt. Export erzeugt wohldefinierte, getestete RTF-Gruppen und korrekte Escape-Sequenzen; einfache Textumbenennung ist kein RTF-Export.

## EPUB

Geplanter EPUB-3-Adapter mit ZIP-Container, `mimetype`, `META-INF/container.xml`, OPF, Spine, Navigation und XHTML-Kapiteln. Überschriften erzeugen Navigation und Kapitelgrenzen nach gewähltem Profil. Bilder und zulässige Schriften werden paketiert; Metadaten und Sprache werden übernommen. Import folgt der Spine-Lesereihenfolge. Reflowable EPUB hat dynamische Seitenumbrüche; die Word-Seitenzahl bleibt nicht erhalten. EPUBCheck und Tests in mindestens zwei Lesesystemen gehören zur Abnahme.

## Qualitätsstrategie

- Eigene Formatdateien: Schema-/Versionsvalidierung, unverändertes Öffnen/Speichern, beschädigte und zu große Dateien, Migrationen, unbekannte Knotentypen und Recovery.
- Konverter: sinnvoller Referenzkorpus statt Tests, die nur dieselbe Serializer-Implementierung nachbauen.
- Roundtrip: Inhalt, Stilzuordnung, Tabellenstruktur und Ressourcen vergleichen; zusätzlich visuell prüfen, wo Layout eine Rolle spielt.
- Schriften: fehlende Familie, Unicode-Fallback, Umlaute/ß, Variable-Font-Achsen und PDF-Textauswahl mit tatsächlichen Fontdateien prüfen.
- Sicherheit: keine externen Downloads, keine aktiven Inhalte, ZIP-/XML-Limits und verständliche Abbrüche.
- Verlustbericht: konkret „Kopfzeilen wurden nicht übernommen“ statt „Konvertierung erfolgreich“, wenn bekannte relevante Teile entfallen.

Eine Exportdatei wird erst nach erfolgreicher Erzeugung und Validierung an den gewählten Zielpfad geschrieben. Die unveränderte Originaldatei bleibt bei einem Importfehler erhalten.
