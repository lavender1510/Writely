# Lokal gebündelte Wörterbücher

Die App lädt ausschließlich diese lokalen Dateien. Es gibt keine Wörterbuch-Downloads zur Laufzeit und keinen Online-Prüfdienst.

- Deutsch (`de-DE`): unveränderte `index.aff`/`index.dic` aus `dictionary-de` 3.0.0 (igerman98, Version 20161207), GPL Version 2 oder 3. Original-Copyright und Lizenz stehen in `de-DE/license`; beide vollständigen GPL-Texte liegen unter `licenses/`. Der korrespondierende ursprüngliche Quellcode ist als `de-DE/igerman98-20161207.tar.bz2` beigefügt. Herkunft: https://www.j3e.de/ispell/igerman98/dict/igerman98-20161207.tar.bz2 . Die Wörterbuchdateien selbst liegen ebenfalls unverpackt und unverändert vor.
- Englisch (`en-US`): unveränderte Dateien aus `dictionary-en` 4.0.0, SCOWL/Hunspell-Daten von 2020.12.07. Originalhinweise und MIT-/BSD-Lizenzbedingungen stehen in `en-US/license`.

Die mitgelieferten Paket-Readmes dokumentieren die Herkunft. Wörterbuchdaten bleiben unter ihren eigenen Lizenzen; diese Angabe legt keine Lizenz für Writely-eigenen Code fest. Die MIT-Komponente nspell führt die Prüfung in einem separaten lokalen Worker aus. Benutzerwörter stehen im App-Datenordner und werden nicht in die Originalwörterbücher geschrieben.

Die Prüfung ist wortbasiert. Sie ersetzt keine Grammatikprüfung; komplexe deutsche Zusammensetzungen und Eigennamen können als unbekannt erscheinen. Eigene Wörter lassen sich über das Kontextmenü oder die Einstellungen ergänzen.
