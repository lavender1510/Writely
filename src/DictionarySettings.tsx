import { useEffect, useState } from 'react';
import { getApi } from './browser';
const api = getApi();
export default function DictionarySettings() {
  const [language, setLanguage] = useState('de-DE'),
    [words, setWords] = useState<string[]>([]),
    [word, setWord] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    api
      .dictionaryWords?.(language)
      .then((w) => {
        if (alive) setWords(w);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [language]);
  const change = async (value: string, remove: boolean) => {
    setBusy(true);
    setError('');
    try {
      if (!api.dictionaryChange)
        throw new Error('Das Benutzerwörterbuch ist in der Desktop-App verfügbar.');
      setWords(await api.dictionaryChange(language, value, remove));
      setWord('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <h3>Benutzerwörterbuch</h3>
      <p>
        Eigene Wörter ergänzen die lokal gebündelten Wörterbücher. Text wird an keinen Online-Dienst
        übertragen.
      </p>
      <label className="field-label">
        Wörterbuchsprache
        <select
          className="wide-select"
          aria-label="Wörterbuchsprache"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="de-DE">Deutsch</option>
          <option value="en-US">English (US)</option>
        </select>
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void change(word, false);
        }}
      >
        <label className="field-label">
          Eigenes Wort
          <input
            className="text-input"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            maxLength={80}
          />
        </label>
        <button className="secondary-button" disabled={busy || !word.trim()}>
          Wort hinzufügen
        </button>
      </form>
      <div className="dictionary-words">
        {words.map((w) => (
          <div key={w}>
            <span>{w}</span>
            <button
              aria-label={`${w} aus Wörterbuch entfernen`}
              disabled={busy}
              onClick={() => change(w, true)}
            >
              Entfernen
            </button>
          </div>
        ))}
      </div>
      {!words.length && <p>Noch keine eigenen Wörter für diese Sprache.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
