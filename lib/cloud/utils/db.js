async function createDb(data) {
  console.log('[db] Creating data: ', data);
  return data;
}

async function readDb(data) {
  console.log('[db] Reading data: ', data);
  return data;
}

async function updateDb(data) {
  console.log('[db] Updating data: ', data);
  return data;
}

async function deleteDb(data) {
  console.log('[db] Deleting data: ', data);
  return data;
}

export { createDb, readDb, updateDb, deleteDb };