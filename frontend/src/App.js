import React from "react";
import "./App.css";
import SearchSlots from "./components/Booking/SearchSlots";

function App() {
  return (
    <div className="App">
      <header>
        <h1>HC-ABS — Book a clinic appointment</h1>
        <p style={{ marginTop: 6 }}>Quick — pick a specialist, choose a slot and book.</p>
      </header>

      <main style={{ flex: 1 }}>
        <SearchSlots />
      </main>

      <footer>
        © {new Date().getFullYear()} HC-ABS — Demo
      </footer>
    </div>
  );
}

export default App;

