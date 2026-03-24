/**
 * @file        migrate.js
 * @description Standalone migration runner (legacy — migrations now run inside database.js initDb)
 * @module      Database
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { getDb } from './database.js';
getDb();
console.log('✅ Schema applied. Run `node src/db/seed.js` to add data.');
