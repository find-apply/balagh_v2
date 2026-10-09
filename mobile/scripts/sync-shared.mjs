// Copies the web app's types and labels, so the app and the site speak the same API with the same words.
// Run after changing web/src/types.ts, labels.ts, audiences.ts or tasks.ts: npm run sync
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const web = join(here, '..', '..', 'web', 'src')
const out = join(here, '..', 'src', 'shared')
for (const name of ['types.ts', 'labels.ts', 'audiences.ts', 'tasks.ts']) {
  const body = readFileSync(join(web, name), 'utf8')
  writeFileSync(join(out, name), `// Copied from web/src/${name} by scripts/sync-shared.mjs: edit it there, then run npm run sync.\n${body}`)
}
console.log('synced', out)
