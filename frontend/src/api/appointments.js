import api from "./client";
export const fetchSlots = () => api.get("/slots/");
export const createPatient = (data) => api.post("/patients/", data);
export const createAppointment = (data) => api.post("/appointments/", data);
