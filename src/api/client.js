// src/api/client.js
const STORAGE_PREFIX = 'race_connect_hub_';

const SEED_RACES = [
  {
    id: 'race-1',
    name: 'Mitja Marató de Terrassa',
    date: '2027-01-24',
    distance: 'Media maratón',
    distance_km: 21.097,
    elevation_gain: 180,
    city: 'Terrassa',
    location: 'Parc dels Catalans',
    start_time: '10:00',
    price: 24,
    spots: 2500,
    registered: 1420,
    image: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80',
    description: 'Clásica media maratón urbana de asfalto con gran ambiente en Terrassa.',
    status: 'abierta',
    registration_url: 'https://mitjaterrassa.org',
    source: 'manual'
  },
  {
    id: 'race-2',
    name: 'Spartan Race Barcelona - Trifecta',
    date: '2026-11-14',
    distance: 'OCR / Obstáculos',
    distance_km: 21,
    elevation_gain: 950,
    city: 'Súria',
    location: 'Zona Deportiva Súria',
    start_time: '08:30',
    price: 95,
    spots: 3000,
    registered: 2650,
    image: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=800&q=80',
    description: 'Modalidades Sprint, Super y Beast con hasta 30 obstáculos en plena naturaleza.',
    status: 'abierta',
    registration_url: 'https://es.spartan.com',
    source: 'import'
  }
];

function createStore(entityName, seedData = []) {
  const key = `${STORAGE_PREFIX}${entityName}`;

  const getAll = () => {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(seedData));
      return seedData;
    }
    return JSON.parse(raw);
  };

  const saveAll = (items) => {
    localStorage.setItem(key, JSON.stringify(items));
  };

  return {
    filter: async (query = {}, options = {}) => {
      let items = getAll();
      const normalize = (str) =>
        String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

      Object.entries(query).forEach(([k, v]) => {
        if (v === undefined || v === '' || v === null) return;
        if (typeof v === 'object' && v.$regex !== undefined) {
          const pattern = normalize(v.$regex);
          items = items.filter((item) => normalize(item[k]).includes(pattern));
        } else {
          items = items.filter((item) => normalize(item[k]) === normalize(v));
        }
      });

      if (options.sort) {
        const desc = options.sort.startsWith('-');
        const field = desc ? options.sort.slice(1) : options.sort;
        items.sort((a, b) => {
          if (a[field] < b[field]) return desc ? 1 : -1;
          if (a[field] > b[field]) return desc ? -1 : 1;
          return 0;
        });
      }
      if (options.limit) {
        items = items.slice(0, options.limit);
      }
      return { items };
    },
    get: async (id) => {
      return getAll().find((item) => item.id === id) || null;
    },
    create: async (payload) => {
      const items = getAll();
      const currentUser = JSON.parse(localStorage.getItem('race_connect_hub_current_user') || '{}');
      const newItem = {
        ...payload,
        id: payload.id || `${entityName.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        created_by_id: payload.created_by_id || currentUser.id || 'user-admin-1',
        created_date: new Date().toISOString()
      };
      items.push(newItem);
      saveAll(items);
      return newItem;
    },
    update: async (id, payload) => {
      const items = getAll();
      const idx = items.findIndex((item) => item.id === id);
      if (idx === -1) throw new Error(`${entityName} no encontrado`);
      items[idx] = { ...items[idx], ...payload, updated_date: new Date().toISOString() };
      saveAll(items);
      return items[idx];
    },
    delete: async (id) => {
      const items = getAll().filter((item) => item.id !== id);
      saveAll(items);
      return { success: true };
    }
  };
}

export const db = {
  entities: {
    Race: createStore('Race', SEED_RACES),
    Registration: createStore('Registration', []),
    Attendance: createStore('Attendance', []),
    Carpool: createStore('Carpool', []),
    Comment: createStore('Comment', []),
    User: createStore('User', []),
  },
  auth: {
    me: async () => {
      const saved = localStorage.getItem('race_connect_hub_current_user');
      if (saved) return JSON.parse(saved);
      const defaultUser = {
        id: 'user-admin-1',
        full_name: 'Joel Botana',
        email: 'joel@raceconnect.app',
        role: 'admin',
        city: 'Terrassa'
      };
      localStorage.setItem('race_connect_hub_current_user', JSON.stringify(defaultUser));
      return defaultUser;
    },
    loginViaEmailPassword: async (email, password) => {
      const isAdmin = email.toLowerCase().includes('admin') || email.toLowerCase().includes('joel');
      const user = {
        id: isAdmin ? 'user-admin-1' : 'user-' + Date.now(),
        full_name: isAdmin ? 'Joel Botana' : email.split('@')[0],
        email,
        role: isAdmin ? 'admin' : 'user',
        city: 'Terrassa'
      };
      localStorage.setItem('race_connect_hub_current_user', JSON.stringify(user));
      return user;
    },
    loginWithProvider: async (provider, returnTo = '/') => {
      const user = {
        id: 'user-google-1',
        full_name: 'Joel Botana',
        email: 'joel@raceconnect.app',
        role: 'admin',
        city: 'Terrassa'
      };
      localStorage.setItem('race_connect_hub_current_user', JSON.stringify(user));
      window.location.href = returnTo;
      return user;
    },
    register: async ({ email, full_name }) => {
      const user = {
        id: 'user-' + Date.now(),
        full_name: full_name || email.split('@')[0],
        email,
        role: 'user',
        city: 'Terrassa'
      };
      localStorage.setItem('race_connect_hub_current_user', JSON.stringify(user));
      return user;
    },
    logout: async () => {
      localStorage.removeItem('race_connect_hub_current_user');
      return { success: true };
    },
    resetPasswordRequest: async () => ({ success: true }),
    resetPassword: async () => ({ success: true })
  }
};