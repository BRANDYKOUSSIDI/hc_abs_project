// frontend/src/components/Booking/SearchSlots.jsx
import React, { useEffect, useState, useRef } from "react";
import { fetchSpecialties, fetchProviders, fetchSlotsByProvider, generateSlots } from "../../api/client";
import BookingForm from "./BookingForm";
import DoctorCard from "./DoctorCard";

export default function SearchSlots({ provider: initialProvider = null }) {
  const [specialties, setSpecialties] = useState([]);
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedProvider, setSelectedProvider] = useState(initialProvider);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState(null);
  const bookingCardRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([fetchSpecialties(), fetchProviders()])
      .then(([spRes, pRes]) => {
        if (!mounted) return;
        const sp = spRes.data.results ?? spRes.data ?? [];
        const pr = pRes.data.results ?? pRes.data ?? [];
        setSpecialties(sp);
        setProviders(pr);
        setFilteredProviders(pr);
      })
      .catch((e) => setError("Failed to load specialties or providers"))
      .finally(() => mounted && setLoading(false));
    return () => (mounted = false);
  }, []);

  useEffect(() => {
    if (!selectedSpecialty) {
      setFilteredProviders(providers);
    } else {
      setFilteredProviders(providers.filter((p) => p.specialty && p.specialty.id === selectedSpecialty));
    }
    // reset selection
    setSelectedProvider(null);
    setSlots([]);
    setSelectedSlot(null);
  }, [selectedSpecialty, providers]);

  useEffect(() => {
    if (!selectedProvider) return;
    setLoadingSlots(true);
    fetchSlotsByProvider(selectedProvider.id)
      .then((res) => {
        const data = res.data.results ?? res.data ?? [];
        // The backend automatically generates slots if they don't exist,
        // but if still no slots, try generating them explicitly
        if (data.length === 0) {
          return generateSlots(21)
            .then(() => fetchSlotsByProvider(selectedProvider.id))
            .then((res2) => {
              const newData = res2.data.results ?? res2.data ?? [];
              setSlots(newData);
              const firstAvailable = newData.find((s) => s.is_available) ?? newData[0] ?? null;
              setSelectedSlot(firstAvailable);
            });
        }
        setSlots(data);
        const firstAvailable = data.find((s) => s.is_available) ?? data[0] ?? null;
        setSelectedSlot(firstAvailable);
      })
      .catch((err) => {
        console.error("Failed to load slots:", err);
        setError("Failed to load slots for provider");
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedProvider]);

  const handleProviderSelect = (p) => {
    setSelectedProvider(p);
    setSelectedSlot(null);
    setSlots([]);
    // Scroll to booking section when doctor is selected
    setTimeout(() => {
      if (bookingCardRef.current) {
        bookingCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleBooked = () => {
    if (selectedProvider) {
      fetchSlotsByProvider(selectedProvider.id)
        .then((res) => {
          const data = res.data.results ?? res.data ?? [];
          setSlots(data);
          const firstAvailable = data.find((s) => s.is_available) ?? data[0] ?? null;
          setSelectedSlot(firstAvailable);
        })
        .catch(() => {});
    }
  };

  if (loading) return <div className="muted">Loading doctors…</div>;
  if (error) return <div className="muted" style={{ color: "var(--danger)" }}>{error}</div>;
  if (!providers.length) return <div className="muted">No doctors available.</div>;

  return (
    <div style={{ width: "100%" }}>
      {/* Filter + small provider list */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <label style={{ fontWeight: 700, minWidth: 130 }}>Filter by specialty</label>
          <select value={selectedSpecialty} onChange={(e) => setSelectedSpecialty(e.target.value)} style={{ padding: 10, borderRadius: 8 }}>
            <option value="">All specialties</option>
            {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="doctor-grid">
          {filteredProviders.map((d) => (
            <DoctorCard key={d.id} doctor={d} onSelect={handleProviderSelect} />
          ))}
        </div>

        {/* booking bottom card (centered) */}
        <div className="booking-bottom">
          <div className="booking-card" ref={bookingCardRef}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2>Please select a provider and slot to book.</h2>
                <div className="subinfo">Select a provider to begin</div>
              </div>
              <div style={{ textAlign: "right" }}>
                {selectedProvider ? (
                  <>
                    <div style={{ fontWeight: 800 }}>{selectedProvider.name}</div>
                    <div style={{ color: "var(--muted)" }}>{selectedProvider.specialty?.name}</div>
                    <div style={{ marginTop: 8, fontWeight: 800, color: "var(--accent)" }}>
                      ${Number(selectedProvider.fee || 15).toFixed(2)}
                    </div>
                  </>
                ) : (
                  <div className="muted">Choose a doctor above to view available times.</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              {/* Show slots + booking form when provider selected */}
              {selectedProvider && (
                <>
                  <div style={{ marginBottom: 16, fontWeight: 700, fontSize: 18 }}>{selectedProvider.name} — Available Appointment Times</div>

                  {loadingSlots && <div className="muted" style={{ marginBottom: 16 }}>Loading available slots…</div>}
                  
                  {!loadingSlots && slots.length > 0 && (
                    <div className="slot-container" style={{ marginBottom: 20 }}>
                      {slots.map((s) => (
                        <div 
                          key={s.id} 
                          className="slot" 
                          aria-disabled={!s.is_available} 
                          onClick={() => s.is_available && setSelectedSlot(s)} 
                          style={{
                            border: selectedSlot && selectedSlot.id === s.id ? "2px solid var(--accent)" : undefined,
                            cursor: s.is_available ? "pointer" : "not-allowed",
                            opacity: s.is_available ? 1 : 0.6
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{new Date(s.start).toLocaleString()}</div>
                          <div style={{ fontSize: 12, color: s.is_available ? "var(--success)" : "#556" }}>
                            {s.is_available ? "✓ Available" : "✗ Booked"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!loadingSlots && !slots.length && (
                    <div className="muted" style={{ marginBottom: 20, padding: 16, background: "#f8fafc", borderRadius: 8 }}>
                      No slots available for this doctor at the moment. Please check back later.
                    </div>
                  )}

                  {/* Booking form - always show when doctor is selected */}
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: "2px solid #eef2ff" }}>
                    <BookingForm slot={selectedSlot} provider={selectedProvider} onBooked={() => handleBooked()} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
