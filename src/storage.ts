const DB = 'uniway-private-v1';
async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function readSession() {
  const db = await open();
  return new Promise<any>((resolve, reject) => {
    const t = db.transaction('state', 'readonly'),
      r = t.objectStore('state').get('session');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    t.oncomplete = () => db.close();
  });
}
export async function writeSession(value: unknown) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction('state', 'readwrite');
    t.objectStore('state').put(value, 'session');
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
}
export async function clearSession() {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction('state', 'readwrite');
    t.objectStore('state').clear();
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => reject(t.error);
  });
}
