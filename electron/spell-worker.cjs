const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const nspell = require('nspell');
const dictionaries = new Map();
parentPort.on('message', (message) => {
  try {
    const { id, language, words, word, custom, action } = message;
    let spell = dictionaries.get(language);
    if (!spell) {
      spell = nspell(
        fs.readFileSync(path.join(workerData.root, language, 'index.aff')),
        fs.readFileSync(path.join(workerData.root, language, 'index.dic')),
      );
      dictionaries.set(language, spell);
    }
    const own = new Set(custom.map((w) => w.toLocaleLowerCase(language)));
    let result;
    if (action === 'suggest') result = spell.suggest(word).slice(0, 6);
    else result = words.filter((w) => !own.has(w.toLocaleLowerCase(language)) && !spell.correct(w));
    parentPort.postMessage({ id, result });
  } catch (e) {
    parentPort.postMessage({
      id: message.id,
      error: 'Das lokale Wörterbuch konnte nicht geladen werden: ' + e.message,
    });
  }
});
