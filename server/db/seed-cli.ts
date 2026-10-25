import 'dotenv/config';
import { createDatabase } from './database.js';
import { seed, resetDemo } from './seed.js';
const db = createDatabase(process.env.DATABASE_PATH || './data/labmate.sqlite');
if (process.argv.includes('--reset-demo')) {
  resetDemo(db);
  console.log(
    'Demo lab reset, including all activity on its published links. Other labs preserved.',
  );
} else {
  seed(db);
  console.log('Demo data ready (existing lab preserved).');
}
db.close();
