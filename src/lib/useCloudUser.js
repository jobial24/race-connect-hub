import { useEffect, useState } from 'react';
import { getUser } from './supabase';

/** Usuario de Supabase conectado (o null), reactivo a login/logout. */
export function useCloudUser() {
  const [user, setUser] = useState(getUser);
  useEffect(() => {
    const on = (e) => setUser(e.detail ?? getUser());
    window.addEventListener('auth:changed', on);
    return () => window.removeEventListener('auth:changed', on);
  }, []);
  return user;
}
