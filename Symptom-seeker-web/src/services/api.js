const BASE_URL = 'http://127.0.0.1:8000';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  async signup(userId, password) {
    const res = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, password }),
    });
    if (!res.ok) throw new Error('Signup failed');
    return res.json();
  },

  async login(username, password) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user_id', username);
    }
    return data;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
  },

  async getMe() {
    const res = await fetch(`${BASE_URL}/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
  },

  async getConversations() {
    const res = await fetch(`${BASE_URL}/conversations`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return res.json();
  },

  async createConversation(title, isolated = false) {
    const res = await fetch(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, isolated }),
    });
    if (!res.ok) throw new Error('Failed to create conversation');
    return res.json();
  },

  async setActiveConversation(conversationId) {
    const res = await fetch(`${BASE_URL}/conversations/${conversationId}/active`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to set active conversation');
    return res.json();
  },

  async getConversation(conversationId) {
    const res = await fetch(`${BASE_URL}/conversations/${conversationId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch conversation');
    return res.json();
  },

  async triage(symptom) {
    const res = await fetch(`${BASE_URL}/triage`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ symptom }),
    });
    if (!res.ok) throw new Error('Triage failed');
    return res.json();
  },

  async triageIgnoreHistory(symptom) {
    const res = await fetch(`${BASE_URL}/triage-ignore-history`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ symptom }),
    });
    if (!res.ok) throw new Error('Triage (ignore history) failed');
    return res.json();
  },

  async summarizeConversation(conversationId) {
    const res = await fetch(`${BASE_URL}/conversations/${conversationId}/summarize`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Summarization failed');
    }
    return res.json();
  },
};