// frontend/src/api/client.js
import axios from "axios";

/**
 * API client for the frontend.
 * - Reads base URL from REACT_APP_API_URL (create .env.local in frontend root)
 * - Automatically sets Authorization header when an access_token is stored in localStorage
 * - Tries to refresh token on 401 using refresh_token (optional; requires simplejwt endpoints)
 */

// Base API URL (ensure .env.local has REACT_APP_API_URL=http://127.0.0.1:8000/api)
const BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// token helpers
const getAccessToken = () => localStorage.getItem("access_token");
const getRefreshToken = () => localStorage.getItem("refresh_token");
const saveTokens = ({ access, refresh }) => {
  if (access) localStorage.setItem("access_token", access);
  if (refresh) localStorage.setItem("refresh_token", refresh);
};
const clearTokens = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
};

// attach access token to requests
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// simple 1-step refresh-once logic for 401 responses
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token);
    }
  });

  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If no response or not 401 -> reject
    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    // Prevent infinite loop
    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // If refresh token available, try refresh
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // queue the request until refresh finished
      return new Promise(function (resolve, reject) {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers["Authorization"] = "Bearer " + token;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    isRefreshing = true;

    try {
      const resp = await axios.post(`${BASE_URL}/token/refresh/`, {
        refresh: refreshToken,
      });

      const newAccess = resp.data.access;
      saveTokens({ access: newAccess });
      api.defaults.headers.common["Authorization"] = `Bearer ${newAccess}`;
      processQueue(null, newAccess);
      return api(originalRequest);
    } catch (err) {
      processQueue(err, null);
      clearTokens();
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

/* -----------------------
   Helper API functions
   ----------------------- */

// Specialties
export const fetchSpecialties = () => api.get("/specialties/");

// Providers (list)
export const fetchProviders = (params = {}) => api.get("/providers/", { params });

// Provider slots (by provider id) - uses the @action on ProviderViewSet
export const fetchSlotsByProvider = (providerId, params = {}) =>
  api.get(`/providers/${providerId}/slots/`, { params });

// Generic slots listing (filterable by provider query param)
export const fetchSlots = (params = {}) => api.get(`/slots/`, { params });

// Patients: create patient record
export const createPatient = (payload) => api.post("/patients/", payload);

// Appointments: create booking
export const createAppointment = (payload) => api.post("/appointments/", payload);

// Appointments: list by patient contact
export const fetchAppointmentsByContact = ({ phone, email }) =>
  api.get("/appointments/by_contact/", { params: { phone, email } });

// Appointments: cancel
export const cancelAppointment = (id) => api.post(`/appointments/${id}/cancel/`);

// Generate slots for all providers
export const generateSlots = (days = 21) => api.post(`/generate-slots/?days=${days}`);

// Auth: register (minimal / uses your RegisterView which creates a Patient)
export const register = (payload) => api.post("/register/", payload);

// Auth: login -> obtains JWT tokens (expects simplejwt TokenObtainPairView)
// Supports both username and email for login
export const login = async ({ username, email, password }) => {
  const resp = await api.post("/token/", { username: username || email, password });
  const { access, refresh } = resp.data;
  saveTokens({ access, refresh });
  return resp;
};

// Auth: logout
export const logout = () => {
  clearTokens();
  // optionally call backend logout if implemented
};

// Utility: get current user tokens / auth status
export const isAuthenticated = () => !!getAccessToken();
export const getAuthHeaders = () => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default api;
