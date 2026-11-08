# Drittanbieterhinweise

Die folgenden Angaben beziehen sich auf die im Entwicklungs-Lockfile dieser Vorabversion aufgelösten direkten Abhängigkeiten. Die jeweiligen vollständigen Copyright- und Lizenztexte der Komponenten bleiben maßgeblich. Diese Hinweise legen keine Lizenz für Writely-eigenen Produktcode fest.

## Mitgelieferte Schriftarten

| Schrift | Paket / aufgelöste Version | Lizenz | Vollständiger Text |
| --- | --- | --- | --- |
| Inter | `@fontsource/inter` 5.3.0 | SIL Open Font License 1.1 | [LICENSE-inter.txt](licenses/LICENSE-inter.txt) |
| Source Serif 4 | `@fontsource/source-serif-4` 5.3.1 | SIL Open Font License 1.1 | [LICENSE-source-serif-4.txt](licenses/LICENSE-source-serif-4.txt) |

Die Originaltexte wurden unverändert aus den installierten Fontsource-Paketen übernommen. Inter nennt „The Inter Project Authors“, Source Serif 4 nennt in diesem Paket „Google Inc.“. Die Fontdateien werden lokal gebündelt. Angezeigte Systemschriftfamilien wie Arial, Calibri oder Segoe UI bedeuten nicht, dass Writely deren proprietäre Dateien mitliefert.

## Direkte Laufzeitkomponenten

| Komponente | Aufgelöste Version | Paketlizenz |
| --- | --- | --- |
| React / React DOM | 19.3.1 | MIT |
| Tiptap React, Starter Kit, Highlight, Image, Table, Text Align, Text Style | 3.33.0 | MIT |
| `docx` | 9.15.3 | MIT |
| Mammoth | 1.13.0 | BSD-2-Clause |
| `font-list` | 2.1.0 | MIT |
| `htmlparser2` | 10.1.0 | MIT |
| Lucide React | 0.468.0 | ISC |
| Marked | 17.0.6 | MIT |
| `sanitize-html` | 2.18.1 | MIT |
| Turndown | 7.2.5 | MIT |

Electron 45.2.3 wird zur Laufzeit mitgeliefert und steht als Projekt unter MIT. Es enthält Chromium, Node.js und weitere Komponenten mit eigenen Lizenzen. Die durch Electron mitgelieferten Lizenzdateien, insbesondere `LICENSES.chromium.html`, müssen im Desktoppaket erhalten bleiben. Die MIT-Angabe für Electron ersetzt diese separaten Komponentenhinweise nicht.

## Entwicklungs- und Testwerkzeuge

| Komponente | Aufgelöste Version | Paketlizenz |
| --- | --- | --- |
| Playwright Test | 1.65.0 | Apache-2.0 |
| TypeScript | 5.9.3 | Apache-2.0 |
| Vite | 7.3.7 | MIT |
| Vite React Plugin | 5.2.0 | MIT |
| electron-builder | 26.18.0 | MIT |
| tsx | 4.23.15 | MIT |
| `@types/node` | 24.19.2 | MIT |
| `@types/react` | 19.3.0 | MIT |
| `@types/react-dom` | 19.3.0 | MIT |

Paketlizenzangaben wurden aus den tatsächlich installierten `package.json`-Dateien geprüft. Transitive Pakete und ihre Lizenztexte gehören ebenfalls zum ausgelieferten Abhängigkeitsbaum; diese Tabelle ist keine vollständige Inventarliste aller transitiven Dateien. Beim Paketieren bleiben deren Lizenzdateien sowie die Electron-/Chromium-Hinweise erhalten.

## Pandoc 3.13

Pandoc wird als separates lokales Programm aufgerufen und im Windows-Paket mitgeliefert. Lizenz: GNU GPL, Version 2 oder später, siehe `tools/COPYING.md`. Der korrespondierende Quellcode liegt als `tools/pandoc-source.tar.gz` bei. Herkunft: https://github.com/jgm/pandoc/releases/tag/3.13 . Die App benötigt zur Nutzung keine Verbindung zu diesem Dienst.
