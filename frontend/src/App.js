import React, { useMemo, useState, useEffect } from "react";
import "./App.css";
import SearchSlots from "./components/Booking/SearchSlots";
import MyAppointments from "./components/Booking/MyAppointments";
import { isAuthenticated, logout } from "./api/client";

function App() {
  const isDashboard = window.location.pathname === "/dashboard";
  const [authed, setAuthed] = useState(isAuthenticated());

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  const accountBar = useMemo(() => (
    <div style={{ background: "#0f172a", color: "white", padding: "6px 12px", textAlign: "right" }}>
      {authed ? (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, opacity: 0.9 }}>Signed in</span>
          <button
            className="btn"
            style={{ padding: "6px 10px" }}
            onClick={() => {
              logout();
              setAuthed(false);
              window.location.href = "/";
            }}
          >
            Logout
          </button>
        </div>
      ) : (
        <span style={{ fontSize: 13, opacity: 0.9 }}>Not signed in</span>
      )}
    </div>
  ), [authed]);

  return (
    <div className="App">
      {accountBar}
      <header>
        <h1>HC-ABS — Book a clinic appointment</h1>
        <p style={{ marginTop: 6 }}>Quick — pick a specialist, choose a slot and book.</p>
        <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "center" }}>
          <button className="btn" onClick={() => (window.location.pathname = "/")}>
            Booking
          </button>
          <button className="btn" onClick={() => (window.location.pathname = "/dashboard")}>
            My appointments
          </button>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {isDashboard ? <MyAppointments /> : <SearchSlots />}
      </main>

      <footer>
        © {new Date().getFullYear()} HC-ABS — Demo
      </footer>
    </div>
  );
}

export default App;

