import React from 'react';
import { Trophy, Calendar, Shield, LogOut, User, Ticket } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import SignupPrompt from '@/components/SignupPrompt';
import { useCloudUser } from '@/lib/useCloudUser';
import { useIsAdmin } from '@/lib/useIsAdmin';
import { cloudEnabled, displayName, signOut } from '@/lib/supabase';

const NAV = [
  { label: 'Calendario', long: 'Calendario Oficial 2026', path: '/', icon: Calendar },
  { label: 'Mis carreras', long: 'Mis inscripciones', path: '/my-races', icon: Ticket },
  { label: 'Admin', long: 'Admin', path: '/admin', icon: Shield },
];

function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
        <Trophy className="w-5 h-5" />
      </div>
      <div>
        <span className="font-bold text-white tracking-tight text-base block leading-tight">Race Connect</span>
        {!compact && <span className="text-[10px] text-gray-400 uppercase tracking-widest">Hub v1.0</span>}
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useCloudUser();
  const isAdmin = useIsAdmin();
  const visibleNav = NAV.filter((item) => item.path !== '/admin' || isAdmin === true);

  return (
    <div className="flex h-[100dvh] w-full bg-[#0B0F19] text-gray-200 overflow-hidden font-sans">
      {/* Escritorio: barra lateral */}
      <aside className="hidden md:flex w-64 bg-[#0e1320] border-r border-white/5 p-5 flex-col justify-between shrink-0">
        <div>
          <div className="px-2 py-3 mb-6">
            <Logo />
          </div>
          <nav className="space-y-1.5">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    active ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.long}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-white/5">
          <div className="flex items-center justify-between p-2 rounded-xl bg-black/20 border border-white/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{user ? displayName(user) : cloudEnabled ? 'Invitado' : 'Modo local'}</p>
                <p className="text-[10px] text-gray-400 truncate">
                  {user ? user.email : cloudEnabled ? 'Entra para sincronizar' : 'Sin base de datos'}
                </p>
              </div>
            </div>
            <button
              title={user ? 'Cerrar sesión' : 'Entrar'}
              onClick={() => (user ? signOut() : navigate('/login'))}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Móvil: cabecera compacta (respeta el notch) */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-[#0e1320]/95 backdrop-blur border-b border-white/5">
          <Logo compact />
          <button
            title="Cuenta"
            onClick={() => navigate('/login')}
            className={`h-9 rounded-xl border flex items-center justify-center gap-1.5 px-2.5 text-xs font-semibold ${
              user ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-orange-500/15 border-orange-500/30 text-orange-400'
            }`}
          >
            <User className="w-4 h-4" />
            {user ? displayName(user).slice(0, 10) : cloudEnabled ? 'Entrar' : ''}
          </button>
        </header>

        <main className="flex-1 flex flex-col overflow-y-auto overscroll-contain pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      {/* Móvil: barra de pestañas inferior, como una app nativa */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0e1320]/95 backdrop-blur border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-3">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold cursor-pointer ${
                  active ? 'text-orange-400' : 'text-gray-500'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'scale-110' : ''} transition-transform`} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <SignupPrompt />
    </div>
  );
}
