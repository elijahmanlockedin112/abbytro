// Joker definitions are shipped as JSON so they can be edited without touching code.
// Node reads the file directly; the browser fetches it.
let cache = null;

export async function loadJokerDefs(base = '') {
  if (cache) return cache;
  if (typeof window === 'undefined') {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const path = fileURLToPath(new URL('./jokers.json', import.meta.url));
    cache = JSON.parse(readFileSync(path, 'utf8'));
  } else {
    cache = await (await fetch(base + 'src/data/jokers.json')).json();
  }
  return cache;
}
