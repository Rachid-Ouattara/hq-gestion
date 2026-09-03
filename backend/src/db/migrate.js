import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'migrations');

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rowCount } = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
    if (rowCount > 0) {
      console.log(`↷ déjà appliquée : ${file}`);
      continue;
    }
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations(name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`✔ appliquée : ${file}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error(`✗ échec : ${file}`);
      throw err;
    }
  }

  await pool.end();
  console.log('Migrations terminées.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
