let db = [];

async function createDb() {
  db = [];
  console.log('[db] Creating DB', db);
  return db;
}

async function readDb() {
  console.log('[db] Reading DB', db);
  return db;
}

async function updateDb(data) {
  db = data;
  console.log('[db] Updating DB', db);
  return db;
}

async function addDb(data) {
  db.push(data);
  console.log('[db] Adding to DB', db);
  return db;
}

async function deleteDb(data) {
  db = db.filter(item => item.id !== data.id);
  console.log('[db] Deleted from DB', db);
  return db;
}

export { createDb, readDb, updateDb, addDb, deleteDb };