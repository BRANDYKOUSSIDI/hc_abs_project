// frontend/src/components/Booking/BookingForm.jsx
import React, { useState, useEffect, useRef } from "react";
import { createPatient, createAppointment, isAuthenticated } from "../../api/client";
import AuthModal from "../Auth/AuthModal";

export default function BookingForm({ slot, provider, onBooked = () => {} }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const [showAuth, setShowAuth] = useState(false);
  const pendingRef = useRef(null);

  useEffect(() => {
    setStatus(null);
  }, [slot, provider]);

  if (!slot || !provider) return <div className="muted">Please select a provider and slot to book.</div>;

  const proceedBooking = async (data) => {
    setBusy(true);
    setStatus(null);
    try {
      const pRes = await createPatient({ full_name: data.fullName, phone: data.phone, email: data.email });
      const patientId = pRes.data.id;

      const apptRes = await createAppointment({
        patient_id: patientId,
        provider_id: provider.id,
        slot_id: slot.id,
      });

      setStatus({ ok: true, msg: `Booked! Appointment id: ${apptRes.data.id}` });
      setFullName("");
      setPhone("");
      setEmail("");
      pendingRef.current = null;
      onBooked();
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

    if (!fullName.trim() || !phone.trim()) {
      setStatus({ ok: false, msg: "Please enter your name and phone." });
      return;
    }

    if (!slot.is_available) {
      setStatus({ ok: false, msg: "This slot is no longer available. Please choose another slot." });
      return;
    }

    if (!isAuthenticated()) {
      pendingRef.current = { fullName: fullName.trim(), phone: phone.trim(), email: email?.trim() ?? "" };
      setShowAuth(true);
      setStatus({ ok: false, msg: "Please sign in or create an account to complete booking." });
      return;
    }

    await proceedBooking({ fullName: fullName.trim(), phone: phone.trim(), email: email?.trim() ?? "" });
  };

  const handleAuthSuccess = async () => {
    setShowAuth(false);
    setStatus({ ok: true, msg: "Authenticated — continuing booking…" });
    const pending = pendingRef.current;
    if (pending) await proceedBooking(pending);
  };

  return (
    <>
      <form className="booking-form" onSubmit={handleSubmit}>
        <div className="slot-summary">
          <div className="slot-date">{slot ? new Date(slot.start).toLocaleString() : ""}</div>
          <div className="slot-provider">Provider: {provider?.name ?? slot?.provider?.name}</div>
        </div>

        <label className="field">
          <span className="label">Full name</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
        </label>

        <label className="field">
          <span className="label">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256700000000" />
        </label>

        <label className="field">
          <span className="label">Email (optional)</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>

        <div className="actions">
          <button type="submit" className="btn primary" disabled={busy || !slot.is_available}>
            {busy ? "Booking…" : slot.is_available ? "Confirm booking" : "Not available"}
          </button>
        </div>

        {status && <div className={`status ${status.ok ? "ok" : "err"}`}>{status.msg}</div>}
      </form>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => handleAuthSuccess()} />}
    </>
  );
}
