/**
 * Central API helper — Frontend → PHP backend.
 * Base URL ek jagah; pages sirf apiGet / apiPost / apiPut call karein.
 */

const API_BASE = 'http://localhost/CRM/backend/api';

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error('Invalid JSON from API');
  }

  if (!res.ok || json.success === false) {
    throw new Error(json.error || `API error (${res.status})`);
  }

  return json.data;
}

export function apiGet(endpoint) {
  return request(endpoint, { method: 'GET' });
}

export function apiPost(endpoint, data) {
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function apiPut(endpoint, data) {
  return request(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function apiDelete(endpoint, data = {}) {
  return request(endpoint, {
    method: 'DELETE',
    body: JSON.stringify(data),
  });
}

export { API_BASE };
