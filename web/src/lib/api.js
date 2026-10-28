const ACCESS_KEY = 'hq_access';
const REFRESH_KEY = 'hq_refresh';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

async function rawFetch(path, options = {}, withAuth = true) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (withAuth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  const res = await fetch(`/api${path}`, { ...options, headers });
  return res;
}

async function tryRefresh() {
  if (!tokens.refresh) return false;
  const res = await rawFetch('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: tokens.refresh }),
  }, false);
  if (!res.ok) return false;
  const data = await res.json();
  tokens.set(data);
  return true;
}

/** Appel API JSON avec refresh transparent sur 401. */
export async function api(path, options = {}) {
  let res = await rawFetch(path, options);
  if (res.status === 401 && tokens.refresh) {
    const ok = await tryRefresh();
    if (ok) {
      res = await rawFetch(path, options);
    } else {
      tokens.clear();
    }
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.message || 'Erreur réseau');
  }
  return data;
}

/** Télécharge une réponse binaire (PDF, Excel…) et déclenche le téléchargement
 * navigateur — même refresh transparent sur 401 que `api()`. Nécessaire car le
 * JWT vit en localStorage : un `<a href>` simple ne porterait pas l'en-tête. */
export async function downloadFile(path, filename) {
  let res = await rawFetch(path);
  if (res.status === 401 && tokens.refresh) {
    const ok = await tryRefresh();
    res = ok ? await rawFetch(path) : res;
  }
  if (!res.ok) throw new Error('Téléchargement impossible');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = (path, body) => api(path, { method: 'PATCH', body: JSON.stringify(body) });
export const put = (path, body) => api(path, { method: 'PUT', body: JSON.stringify(body) });
export const del = (path, body) => api(path, { method: 'DELETE', ...(body ? { body: JSON.stringify(body) } : {}) });

async function rawUpload(path, formData, withAuth = true) {
  const headers = {};
  if (withAuth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  // Pas de Content-Type explicite : le navigateur fixe la frontière multipart lui-même.
  return fetch(`/api${path}`, { method: 'POST', headers, body: formData });
}

/** Upload multipart (FormData) avec le même refresh transparent sur 401 que `api()`. */
export async function uploadFile(path, formData) {
  let res = await rawUpload(path, formData);
  if (res.status === 401 && tokens.refresh) {
    const ok = await tryRefresh();
    if (ok) {
      res = await rawUpload(path, formData);
    } else {
      tokens.clear();
    }
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.message || 'Erreur réseau');
  }
  return data;
}
