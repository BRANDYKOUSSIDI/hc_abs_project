// src/pages/BookingPage.jsx
import React from "react";
import SearchSlots from "../components/Booking/SearchSlots";

export default function BookingPage() {
  return (
    <div className="page-outer">
      <div className="card">
        <header className="card-header">
          <h1 className="brand">HC-ABS</h1>
          <p className="subtitle">Book a clinic appointment — quick & easy</p>
        </header>

        <main className="card-body">
          <SearchSlots />
        </main>

        <footer className="card-footer">
          <small>Powered by HC-ABS • Demo</small>
        </footer>
      </div>
    </div>
  );
}
