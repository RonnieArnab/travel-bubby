import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

export function usePlaces() {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlaces(await api.listPlaces());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { places, loading, error, refresh, setPlaces };
}
