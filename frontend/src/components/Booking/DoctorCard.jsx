// frontend/src/components/Booking/DoctorCard.jsx
// Robust doctor image loader: tries several candidate paths and falls back gracefully.

import React, { useState, useMemo } from "react";

function computeFallbackFee(provider) {
  const key = (provider?.id || provider?.name || "").toString();
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
  const r = sum % 6; // 0..5
  return 15 + r;
}

/**
 * Normalize a doctor's name into several candidate file name patterns.
 * e.g. "Dr. Ahmed" -> ["dr.ahmed","drahmed","dr_ahmed","ahmed"]
 */
function makeNameCandidates(name = "") {
  const raw = (name || "").toLowerCase().trim();
  if (!raw) return [];
  // remove "dr", dots and extra punctuation, but keep tokens
  const cleaned = raw.replace(/doctor/gi, "").replace(/\bdr\b/gi, "").replace(/[^\w\s-]/g, " ").trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  const joined = tokens.join("");
  const underscored = tokens.join("_");
  const dashed = tokens.join("-");
  const spaced = tokens.join(" ");

  const variants = new Set([
    joined,
    underscored,
    dashed,
    spaced.replace(/\s+/g, "_"),
    (raw).replace(/\s+/g, "_"),
    (raw).replace(/\s+/g, ""),
    (raw).replace(/\./g, ""),
    joined.replace(/\./g, ""),
  ]);

  return Array.from(variants);
}

/**
 * Build candidate image URLs (public folder) by trying:
 * /images/doctors/<candidate>.(jpg|jpeg|png)
 * and also a small set of generic filenames (doctor1, doctor2...) as fallback.
 */
function buildDoctorSrcCandidates(name) {
  const candidates = [];
  const nameVariants = makeNameCandidates(name);
  const exts = ["jpg", "jpeg", "png"];
  for (const v of nameVariants) {
    for (const e of exts) {
      candidates.push(`/images/doctors/${v}.${e}`);
    }
  }
  // also add a couple generic fallback names in case you used "doctor1.jpg"
  for (let i = 1; i <= 20; i++) candidates.push(`/images/doctors/doctor${i}.jpg`);
  for (let i = 1; i <= 10; i++) candidates.push(`/images/doctors/doctor${i}.png`);
  // final fallback
  candidates.push("/images/doctors/placeholder.png");
  candidates.push("/placeholder.png");
  return candidates;
}

/**
 * Specialty image candidates similar approach
 */
function buildSpecialtyCandidates(specialtyName) {
  const s = (specialtyName || "").toLowerCase().trim();
  if (!s) return [];
  const cleaned = s.replace(/[^\w\s-]/g, " ").trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const joined = tokens.join("_");
  const exts = ["jpg", "jpeg", "png"];
  const list = [];
  for (const e of exts) {
    list.push(`/images/specialties/${joined}.${e}`);
  }
  // try some human-friendly aliases
  list.push(`/images/specialties/${tokens.join("")}.jpg`);
  list.push(`/images/specialties/${joined.replace(/\s+/g, "-")}.jpg`);
  return list;
}

export default function DoctorCard({ doctor = {}, onSelect = () => {} }) {
  const [imgSrcIndex, setImgSrcIndex] = useState(0);
  const [specSrcIndex, setSpecSrcIndex] = useState(0);

  // Compose candidate lists once per doctor
  const doctorCandidates = useMemo(() => {
    // If backend provided a photo:
    const arr = [];
    if (doctor?.photo) {
      // If full URL, use it first
      if (typeof doctor.photo === "string" && (doctor.photo.startsWith("http") || doctor.photo.startsWith("data:"))) {
        arr.push(doctor.photo);
      } else if (typeof doctor.photo === "string" && doctor.photo.startsWith("/")) {
        // relative backend path -> assume backend on same host
        arr.push(`http://127.0.0.1:8000${doctor.photo}`);
      } else if (typeof doctor.photo === "string") {
        arr.push(doctor.photo);
      }
    }
    // Then local public candidates
    const built = buildDoctorSrcCandidates(doctor?.name || "");
    return arr.concat(built);
  }, [doctor]);

  const specialtyCandidates = useMemo(() => {
    const sname = doctor?.specialty?.name || "";
    return buildSpecialtyCandidates(sname);
  }, [doctor]);

  // current image sources
  const currentImgSrc = doctorCandidates[imgSrcIndex] || "/images/doctors/placeholder.png";
  const currentSpecSrc = specialtyCandidates[specSrcIndex] || null;

  // on error, advance to next candidate
  const onImgError = () => {
    if (imgSrcIndex + 1 < doctorCandidates.length) {
      setImgSrcIndex((i) => i + 1);
    } else {
      // no more candidates -> do nothing (placeholder will show)
    }
  };
  const onSpecError = () => {
    if (specSrcIndex + 1 < specialtyCandidates.length) setSpecSrcIndex((i) => i + 1);
  };

  const fee = (doctor && doctor.fee) ? Number(doctor.fee) : computeFallbackFee(doctor);

  return (
    <div className="doctor-card" onClick={() => onSelect(doctor)} role="button" tabIndex={0}>
      <div style={{ position: "relative" }}>
        <img
          src={currentImgSrc}
          alt={doctor?.name ?? "doctor"}
          onError={onImgError}
          style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
        />
        {currentSpecSrc && (
          <img
            src={currentSpecSrc}
            alt={doctor?.specialty?.name || ""}
            onError={onSpecError}
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              width: 56,
              height: 56,
              objectFit: "cover",
              borderRadius: 8,
              boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
              background: "#fff"
            }}
          />
        )}
      </div>

      <div className="doctor-info">
        <h3>{doctor?.name ?? "Unknown"}</h3>
        <div style={{ fontSize: 13, color: "#556" }}>{doctor?.specialty?.name ?? "General practice"}</div>
        <p style={{ marginTop: 8, fontSize: 13, color: "#333" }}>{doctor?.bio || "Experienced practitioner."}</p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <div className="doctor-fee">${fee.toFixed(2)}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <span className="specialty-badge">Morning 10:00-12:00</span>
            <span className="specialty-badge" style={{ background: "#ecfeff", color: "#036" }}>Afternoon 14:00-16:00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
