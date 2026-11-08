import { useEffect, useState } from 'react';
import WindowSettings from './WindowSettings';
import DictionarySettings from './DictionarySettings';
import { getApi } from './browser';
import type { HistorySettings } from './shared';
const api = getApi();
export default function LibrarySettings({
  onChanged,
  onAbout,
}: {
  onChanged: () => void;
  onAbout: () => void;
}) {
  const [settings, setSettings] = useState<HistorySettings>({
    historyLimit: 30,
    intervalMinutes: 1,
    maxMegabytes: 128,
  });
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    api
      .historySettings?.()
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, []);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="library-settings">
      <h2>Dein Writely</h2>
      <WindowSettings />
      <h3>Sicherungen & Versionshistorie</h3>
      <p>
        Limits gelten getrennt für jedes Dokument. Die aktuelle Fassung bleibt erhalten. Kleinere
        Limits entfernen die ältesten Versionen.
      </p>
      <div className="layout-form-grid">
        {[
          ['historyLimit', 'Versionen pro Dokument', 3, 500],
          ['intervalMinutes', 'Automatische Version alle … Minuten', 1, 60],
          ['maxMegabytes', 'Versionsspeicher pro Dokument (MB)', 64, 1024],
        ].map(([key, label, min, max]) => (
          <label className="field-label" key={key}>
            {label}
            <input
              className="text-input"
              type="number"
              min={min}
              max={max}
              value={settings[key as keyof HistorySettings]}
              onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <button
        disabled={busy}
        className="primary-button"
        onClick={() =>
          run(async () => {
            if (!api.configureHistory)
              throw new Error('Sicherungseinstellungen sind in der Desktop-App verfügbar.');
            setSettings(await api.configureHistory(settings));
            setMessage('Sicherungseinstellungen gespeichert.');
          })
        }
      >
        Sicherungseinstellungen speichern
      </button>
      <h3>Bibliotheksbackup</h3>
      <p>
        Dokumente einschließlich Papierkorb, Ordner, eigene Vorlagen und Vorlagensätze in einer
        lokalen Datei sichern. Separate Versionsdateien und Explorer-Originaldateien gehören nicht
        zum Bibliotheksbackup.
      </p>
      <div className="modal-actions">
        <button
          disabled={busy}
          className="secondary-button"
          onClick={() =>
            run(async () => {
              if (!api.exportBackup)
                throw new Error('Bibliotheksbackups stehen in der Desktop-App zur Verfügung.');
              if (await api.exportBackup()) setMessage('Bibliotheksbackup gespeichert.');
            })
          }
        >
          Bibliothek sichern
        </button>
        <button
          disabled={busy}
          className="secondary-button"
          onClick={() =>
            run(async () => {
              if (!api.importBackup)
                throw new Error('Bibliotheksbackups stehen in der Desktop-App zur Verfügung.');
              const result = await api.importBackup();
              if (result) {
                onChanged();
                setMessage(
                  `${result.documents} Dokumente und ${result.folders} Ordner zusätzlich wiederhergestellt.`,
                );
              }
            })
          }
        >
          Backup wiederherstellen
        </button>
      </div>
      <p>
        Beim Wiederherstellen bleiben vorhandene Daten erhalten. Mehrfaches Importieren ergänzt
        weitere Kopien. Dateien werden vor der Übernahme geprüft.
      </p>
      <DictionarySettings />
      <h3>Darstellung</h3>
      <button
        className="secondary-button"
        onClick={() => {
          const dark = document.documentElement.dataset.theme !== 'dark';
          document.documentElement.dataset.theme = dark ? 'dark' : 'light';
          localStorage.setItem('writely.theme', dark ? 'dark' : 'light');
        }}
      >
        Helles / dunkles Design
      </button>
      <button className="secondary-button" onClick={onAbout}>
        Über Writely
      </button>
      {busy && <p role="status">Wird lokal verarbeitet …</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
