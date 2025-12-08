// frontend/src/components/Booking/BookingForm.jsx
import React, { useState, useEffect } from "react";
import { createPatient, createAppointment } from "../../api/client";
import AuthModal from "../Auth/AuthModal";

const normalizePhone = (v = "") => (v || "").replace(/\D+/g, "");

export default function BookingForm({ slot, provider, onBooked = () => {} }) {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [pending, setPending] = useState(null); // store booking data until user logs in

  useEffect(() => {
    setStatus(null);
  }, [slot, provider]);

  // Show form as soon as provider is selected, even without a slot
  if (!provider) return <div className="muted">Please select a doctor to book an appointment.</div>;

  const proceedBooking = async (data) => {
    setBusy(true);
    setStatus(null);
    try {
      const pRes = await createPatient({ full_name: data.fullName, phone: data.phone, email: data.email });
      const patientId = pRes.data.id;

      // remember contact for dashboard retrieval
      if (data.phone) localStorage.setItem("last_contact_phone", data.phone);
      if (data.email) localStorage.setItem("last_contact_email", data.email);

      const apptRes = await createAppointment({
        patient_id: patientId,
        provider_id: provider.id,
        slot_id: slot.id,
      });

      setStatus({ ok: true, msg: `Booked! Appointment id: ${apptRes.data.id}` });
      setUsername("");
      setFullName("");
      setPhone("");
      setEmail("");
      onBooked();
      // after successful booking, go to dashboard
      const phone = data.phone ? encodeURIComponent(data.phone) : "";
      const email = data.email ? encodeURIComponent(data.email) : "";
      window.location.href = `/dashboard?phone=${phone}&email=${email}`;
    } catch (err) {
      console.error("Booking error:", err);
      const backendMsg = err.response?.data?.detail ?? err.response?.data ?? err.message ?? "Booking failed";
      setStatus({ ok: false, msg: backendMsg });
      try { await new Promise((r) => setTimeout(r, 350)); onBooked(); } catch (ignore) {}
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e && e.preventDefault();
    setStatus(null);

    if (!slot) {
      setStatus({ ok: false, msg: "Please select an available time slot first." });
      return;
    }

    if (!username.trim() || !fullName.trim() || !phone.trim()) {
      setStatus({ ok: false, msg: "Please fill in all required fields (Username, Full name, Phone)." });
      return;
    }

    if (!slot.is_available) {
      setStatus({ ok: false, msg: "This slot is no longer available. Please choose another slot." });
      return;
    }

    const normPhone = normalizePhone(phone);
    const payload = { username: username.trim(), fullName: fullName.trim(), phone: normPhone, email: email?.trim() ?? "" };

    // Always ask for auth/registration before booking
    setPending(payload);
    setShowAuth(true);
    setStatus({ ok: false, msg: "Please sign in or create an account to complete booking." });
    return;
  };

  return (
    <>
      <form className="booking-form" onSubmit={handleSubmit}>
        <div className="slot-summary" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Booking with {provider?.name}</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{provider?.specialty?.name}</div>
          {slot && (
            <>
              <div style={{ marginTop: 8, fontWeight: 600 }}>Selected Time: {new Date(slot.start).toLocaleString()}</div>
              <div style={{ fontSize: 12, color: slot.is_available ? "var(--success)" : "var(--danger)", marginTop: 4 }}>
                {slot.is_available ? "✓ Available" : "✗ Not Available"}
              </div>
            </>
          )}
          {!slot && <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13 }}>Please select an available time slot above</div>}
        </div>

        <label className="field">
          <span className="label">Username *</span>
          <input 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            placeholder="Enter your username" 
            required
          />
        </label>

        <label className="field">
          <span className="label">Full name *</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required />
        </label>

        <label className="field">
          <span className="label">Phone *</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256700000000" required />
        </label>

        <label className="field">
          <span className="label">Email (optional)</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
        </label>

        <div className="actions">
          <button type="submit" className="btn primary" disabled={busy || !slot || !slot.is_available}>
            {busy
              ? "Booking…"
              : !slot
              ? "Select a time slot first"
              : slot.is_available
              ? "Confirm booking"
              : "Slot not available"}
          </button>
          <button type="button" className="btn" onClick={() => setShowAuth(true)}>
            Sign in / Create account
          </button>
        </div>

        {status && <div className={`status ${status.ok ? "ok" : "err"}`}>{status.msg}</div>}
      </form>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={async () => {
            setShowAuth(false);
            if (pending) {
              setStatus({ ok: true, msg: "Authenticated — continuing booking…" });
              await proceedBooking(pending);
              setPending(null);
            }
          }}
        />
      )}
    </>
  );
}
