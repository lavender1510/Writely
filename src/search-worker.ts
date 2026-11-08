import { searchBlocks } from './search-core.mjs';
self.onmessage = (event) => {
  try {
    self.postMessage({ result: searchBlocks(event.data) });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
self.postMessage({ ready: true });
