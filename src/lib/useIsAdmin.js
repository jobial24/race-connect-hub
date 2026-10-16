import { useEffect, useState } from 'react';
import { cloudEnabled, rest } from '@/lib/supabase';
import { useCloudUser } from '@/lib/useCloudUser';

/**
 * true / false, o null mientras se comprueba.
 * Sin nube, sin sesión o sin perfil admin → false.
 */
export function useIsAdmin() {
  const user = useCloudUser();
  const userId = user?.id;
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    if (!cloudEnabled || !userId) {
      setIsAdmin(false);
      return undefined;
    }
    let cancelled = false;
    setIsAdmin(null);
    rest(`/profiles?select=is_admin&id=eq.${userId}`)
      .then((rows) => {
        if (!cancelled) setIsAdmin(Boolean(rows?.[0]?.is_admin));
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return isAdmin;
}
