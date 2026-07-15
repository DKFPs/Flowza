export const API = import.meta.env.VITE_API_URL || "";

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API}${endpoint}`;
  return fetch(url, options);
};
