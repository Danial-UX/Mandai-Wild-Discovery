// usePassport — session-only Wild Passport (Requirement 9).
// Stores identified species names in sessionStorage; cleared when the tab closes.

import { useCallback, useEffect, useState } from 'react';

const KEY = 'mandai_passport';

function read() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Badge text for a given count of distinct species.
 * @param {number} count
 * @returns {string|null}
 */
export function badgeFor(count) {
  if (count >= 10) return 'Wild Guardian';
  if (count >= 5) return 'Ranger';
  if (count >= 3) return 'Explorer';
  return null;
}

export function usePassport() {
  const [species, setSpecies] = useState(read);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(species));
    } catch {
      /* ignore quota / disabled storage */
    }
  }, [species]);

  // Add a species, de-duplicating (Requirement 9.8).
  const addSpecies = useCallback((name) => {
    if (!name || typeof name !== 'string') return;
    setSpecies((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }, []);

  return {
    species,
    addSpecies,
    badge: badgeFor(species.length),
  };
}
