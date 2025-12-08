import React, { useState } from "react";
import { register, login } from "../../api/client";

export default function AuthModal({ onClose = () => {}, onSuccess = () => {} }) {
  const [mode, setMode] = useState("login"); // 'login' or 'register'
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const doLogin = async () => {
    setErr(null);
    setBusy(true);
    try {
      await login({ username: username || email, password });
      onSuccess();
    } catch (e) {
      setErr(e.response?.data?.detail ?? JSON.stringify(e.response?.data) ?? e.message);
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    setErr(null);
    setBusy(true);
    try {
      await register({ username, full_name: fullName, phone, email, password });
      await doLogin();
    } catch (e) {
      setErr(e.response?.data ?? e.message);
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.5)",
      zIndex: 2000
    }}>
      <div style={{
        width: 400,
        padding: 20,
        background: "white",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{mode === "login" ? "Login" : "Create Account"}</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>

        <label style={{ display: "block", marginTop: 12 }}>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={mode === "login" ? "Enter your username" : "Choose a username"} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }} />

        {mode === "register" && (
          <>
            <label style={{ display: "block", marginTop: 12 }}>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }} />

            <label style={{ display: "block", marginTop: 8 }}>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }} />
          </>
        )}

        <label style={{ display: "block", marginTop: 12 }}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }} />

        <label style={{ display: "block", marginTop: 8 }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc" }} />

        {err && <div style={{ color: "red", marginTop: 8 }}>{String(err)}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={mode === "login" ? doLogin : doRegister} className="btn primary" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Login" : "Create account"}
          </button>
          <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="btn">
            {mode === "login" ? "Create account" : "Have an account?"}
          </button>
        </div>
      </div>
    </div>
  );
}