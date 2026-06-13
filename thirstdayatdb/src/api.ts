const API_BASE = '/api/data';

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function loadAllFromServer(): Promise<{
  players: any[];
  sessions: any[];
  attendance: any[];
  performances: any[];
  gamePerformances: any[];
  responses: any[];
  awards?: any;
}> {
  try {
    const data = await api('/load');
    return data;
  } catch {
    // Server not available — continue with localStorage
    return {
      players: [],
      sessions: [],
      attendance: [],
      performances: [],
      gamePerformances: [],
      responses: [],
    };
  }
}

export async function saveAllToServer(data: {
  players: any[];
  sessions: any[];
  attendance: any[];
  performances: any[];
  gamePerformances: any[];
  responses: any[];
}): Promise<void> {
  try {
    await api('/save', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch {
    // Silently fail — data is still in localStorage
  }
}

export async function savePlayerToServer(player: any): Promise<void> {
  try { await api('/players', { method: 'POST', body: JSON.stringify(player) }); } catch {}
}

export async function deletePlayerFromServer(id: string): Promise<void> {
  try { await api(`/players/${id}`, { method: 'DELETE' }); } catch {}
}

export async function saveSessionToServer(session: any): Promise<void> {
  try { await api('/sessions', { method: 'POST', body: JSON.stringify(session) }); } catch {}
}

export async function deleteSessionFromServer(id: string): Promise<void> {
  try { await api(`/sessions/${id}`, { method: 'DELETE' }); } catch {}
}

export async function saveAllToServerFireAndForget(data: {
  players: any[];
  sessions: any[];
  attendance: any[];
  performances: any[];
  gamePerformances: any[];
  responses: any[];
}): Promise<void> {
  return saveAllToServer(data);
}