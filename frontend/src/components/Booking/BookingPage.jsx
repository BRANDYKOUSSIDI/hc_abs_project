// frontend/src/components/Booking/BookingPage.jsx
import React from "react";
import SearchSlots from "./SearchSlots";

export default function BookingPage() {
  return (
    <div className="booking-page">
      <h1 className="page-title">Book Appointment</h1>
      <p className="page-subtitle">Select a provider to begin</p>

      {/* SearchSlots renders the grid and the bottom booking card */}
      <SearchSlots />
    </div>
  );
}
