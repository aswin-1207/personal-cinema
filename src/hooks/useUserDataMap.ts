import { useEffect, useState } from 'react';
import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { UserMovie } from '../types/movie';

/** All local user states keyed by canonical id, refreshed on every data change. */
export function useUserDataMap(dataVersion: number) {
  const [map, setMap] = useState<Map<number, UserMovie>>(() => new Map());
  useEffect(() => {
    let alive = true;
    UserMovieRepository.getAll()
      .then((rows) => alive && setMap(new Map(rows.map((r) => [r.movieId, r]))))
      .catch((err) => console.error('Failed to load user data:', err));
    return () => {
      alive = false;
    };
  }, [dataVersion]);
  return map;
}
