# Writely 0.2.1-alpha.1 · Fenstermodus & Monitore

Kleines Update gegen ein auf einem Monitor festhängendes Fenster.

- Einstellungen → Fenster & Bildschirme: Fenster, maximiert oder Vollbild. Die Auswahl wird sofort angewendet und lokal für den nächsten Start gespeichert.
- Normale Windows-Titelleiste und verschiebbares, skalierbares Fenster. Writely kann per Maus oder mit den Windows-Fensterkürzeln zwischen Monitoren bewegt werden.
- Direkte Bildschirmauswahl in den Einstellungen; beim Verschieben wird der Fenstermodus aktiviert.
- `Strg+Umschalt+F11` wechselt zum Fenster zurück. `Esc` verlässt das Vollbild. F11 bleibt der bisherige Schreib-Fokusmodus.
- Fensterposition und Größe werden gespeichert. Nach einem Monitorwechsel oder abgezogenem Bildschirm wird das Fenster auf einen erreichbaren Arbeitsbereich begrenzt. Kleine Displays und Monitore mit negativen Koordinaten werden berücksichtigt.
- Eigene Fensterknöpfe werden ausgeblendet, wenn die native Titelleiste aktiv ist.

Die vorhandenen Dokument-, Bibliotheks- und Konvertierungsfunktionen bleiben enthalten. Alle Einschränkungen von 0.2 gelten weiterhin; siehe [Release-Hinweise](RELEASE-NOTES.md).

Tests: Fensterplatzierung für mehrere/entfernte/kleine Monitore, lokale Einstellungsspeicherung, ungültige Einstellungen und der echte Windows-Wechsel zwischen maximiert, Fenster und Vollbild samt Esc. Die bisherigen Speicher-, Recovery- und Konverterprüfungen laufen ebenfalls.

Windows-Setup und portables ZIP sind unsignierte Vorabversionen. Das vorhandene Setup kann mit dem neuen Setup aktualisiert werden. Dokumente und lokale Bibliothek bleiben im bisherigen App-Datenordner.
