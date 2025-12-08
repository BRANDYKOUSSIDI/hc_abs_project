// frontend/src/components/Booking/MyAppointments.jsx
import React, { useEffect, useState } from "react";
import { fetchAppointmentsByContact, cancelAppointment } from "../../api/client";

function ConfirmModal({ open, onConfirm, onCancel, message = "Are you sure?" }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
      <div style={{ background: "white", padding: 20, borderRadius: 12, width: 360, boxShadow: "0 10px 30px rgba(15,23,42,0.12)" }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Confirm</div>
        <div style={{ color: "#444", marginBottom: 16 }}>{message}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onCancel}>No</button>
          <button className="btn primary" onClick={onConfirm}>Yes</button>
        </div>
      </div>
    </div>
  );
}

export default function MyAppointments() {
  const params = new URLSearchParams(window.location.search);
  const initialPhone = params.get("phone") || localStorage.getItem("last_contact_phone") || "";
  const initialEmail = params.get("email") || localStorage.getItem("last_contact_email") || "";

  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const loadAppointments = async () => {
    if (!phone.trim() && !email.trim()) {
      setError("Enter phone or email to view your appointments.");
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetchAppointmentsByContact({ phone: phone.trim() || undefined, email: email.trim() || undefined });
      const data = res.data.results ?? res.data ?? [];
      setAppointments(data);
      if (!data.length) setMessage("No appointments found for this contact.");
    } catch (err) {
      setError("Failed to load appointments. Check the phone/email and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (phone || email) {
      loadAppointments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = async (id) => {
    setConfirmId(id);
  };

  return (
    <div id="my-appointments" style={{ maxWidth: 900, margin: "32px auto", padding: "0 16px" }}>
      <div style={{ background: "white", padding: 20, borderRadius: 12, boxShadow: "0 8px 24px rgba(15,23,42,0.08)" }}>
        <h2 style={{ marginTop: 0 }}>My Appointments</h2>
        <div className="subinfo" style={{ marginBottom: 12 }}>Find your bookings by phone or email.</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (e.g. +256700000000)"
            style={{ flex: 1, minWidth: 200, padding: 10, borderRadius: 8, border: "1px solid #e6eef8" }}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            style={{ flex: 1, minWidth: 200, padding: 10, borderRadius: 8, border: "1px solid #e6eef8" }}
          />
          <button onClick={loadAppointments} className="btn primary" disabled={loading || (!phone && !email)}>
            {loading ? "Loading..." : "View my appointments"}
          </button>
        </div>

        {error && <div className="status err">{error}</div>}
        {message && <div className="status ok">{message}</div>}

        {appointments.length > 0 && (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            {appointments.map((a) => (
              <div key={a.id} style={{ border: "1px solid #e6eef8", borderRadius: 10, padding: 12, background: "#f8fafc" }}>
                <div style={{ fontWeight: 700 }}>{a.provider?.name ?? "Doctor"}</div>
                <div style={{ color: "#556", fontSize: 13 }}>{a.provider?.specialty?.name}</div>
                <div style={{ marginTop: 6, fontWeight: 600 }}>{new Date(a.start).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: a.status === "cancelled" ? "var(--danger)" : "var(--success)", marginTop: 4 }}>
                  Status: {a.status}
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  {a.status !== "cancelled" && (
                    <button className="btn" onClick={() => handleCancel(a.id)} disabled={loading}>
                      Cancel appointment
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmId}
        message="Cancel this appointment?"
        onCancel={() => setConfirmId(null)}
        onConfirm={async () => {
          if (!confirmId) return;
          setLoading(true);
          setError(null);
          try {
            await cancelAppointment(confirmId);
            setMessage("Appointment cancelled.");
            setConfirmId(null);
            await loadAppointments();
          } catch (err) {
            setError("Failed to cancel appointment.");
            setConfirmId(null);
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
}

