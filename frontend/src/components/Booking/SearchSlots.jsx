// frontend/src/components/Booking/SearchSlots.jsx
import React, { useEffect, useState } from "react";
import { fetchSpecialties, fetchProviders, fetchSlotsByProvider } from "../../api/client";
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
        setSlots(data);
        const firstAvailable = data.find((s) => s.is_available) ?? data[0] ?? null;
        setSelectedSlot(firstAvailable);
      })
      .catch(() => setError("Failed to load slots for provider"))
      .finally(() => setLoadingSlots(false));
  }, [selectedProvider]);

  const handleProviderSelect = (p) => {
    setSelectedProvider(p);
    setSelectedSlot(null);
    setSlots([]);
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
          <div className="booking-card">
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
                  <div style={{ marginBottom: 12, fontWeight: 700 }}>{selectedProvider.name} — Available slots</div>

                  {loadingSlots && <div className="muted">Loading slots…</div>}
                  {!loadingSlots && !slots.length && <div className="muted">No slots available.</div>}

                  <div className="slot-container" style={{ marginBottom: 12 }}>
                    {slots.map((s) => (
                      <div key={s.id} className="slot" aria-disabled={!s.is_available} onClick={() => s.is_available && setSelectedSlot(s)} style={{
                        border: selectedSlot && selectedSlot.id === s.id ? "2px solid var(--accent)" : undefined
                      }}>
                        <div style={{ fontWeight: 700 }}>{new Date(s.start).toLocaleString()}</div>
                        <div style={{ fontSize: 12, color: "#556" }}>{s.is_available ? "Available" : "Booked"}</div>
                      </div>
                    ))}
                  </div>

                  <BookingForm slot={selectedSlot} provider={selectedProvider} onBooked={() => handleBooked()} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
