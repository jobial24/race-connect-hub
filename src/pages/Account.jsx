import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Trophy, Loader2, CloudOff, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  cloudEnabled,
  signIn,
  signUp,
  signOut,
  sendPasswordReset,
  updatePassword,
  consumeAuthRedirect,
  setSessionFromRedirect,
  displayName,
} from '@/lib/supabase';
import { useCloudUser } from '@/lib/useCloudUser';
import { syncWithCloud } from '@/services/myRaces';

/**
 * Cuenta: entrar / crear cuenta / recuperar contraseña (Supabase).
 * Sin Supabase configurado la app funciona en modo local.
 */
export default function Account() {
  const navigate = useNavigate();
  const loc = useLocation();
  const user = useCloudUser();
  const initialMode = loc.pathname.includes('forgot') ? 'forgot' : loc.pathname.includes('reset') ? 'reset' : 'login';
  const [mode, setMode] = useState(initialMode); // login | register | forgot | reset
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [recoveryToken, setRecoveryToken] = useState(null);

  // Vuelta desde el email (confirmación de cuenta o cambio de contraseña)
  useEffect(() => {
    if (!cloudEnabled) return;
    const r = consumeAuthRedirect();
    if (!r?.session) return;
    if (r.type === 'recovery') {
      setRecoveryToken(r.session.access_token);
      setMode('reset');
    } else {
      setSessionFromRedirect(r.session)
        .then(() => syncWithCloud())
        .then(() => setMsg({ ok: true, text: 'Cuenta confirmada. ¡Bienvenido/a!' }))
        .catch((e) => setMsg({ ok: false, text: e.message }));
    }
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'login') {
        await signIn(form.email, form.password);
        await syncWithCloud().catch(() => {});
        navigate('/my-races');
      } else if (mode === 'register') {
        const r = await signUp(form.email, form.password, form.name);
        if (r.needsConfirmation) {
          setMsg({ ok: true, text: 'Te hemos enviado un email para confirmar la cuenta. Ábrelo y vuelve aquí.' });
        } else {
          await syncWithCloud().catch(() => {});
          navigate('/my-races');
        }
      } else if (mode === 'forgot') {
        await sendPasswordReset(form.email);
        setMsg({ ok: true, text: 'Si el email existe, te llegará un enlace para cambiar la contraseña.' });
      } else if (mode === 'reset') {
        await updatePassword(form.password, recoveryToken);
        setMsg({ ok: true, text: 'Contraseña cambiada. Ya puedes entrar.' });
        setMode('login');
      }
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const titles = {
    login: 'Entrar',
    register: 'Crear cuenta',
    forgot: 'Recuperar contraseña',
    reset: 'Nueva contraseña',
  };

  return (
    <div className="min-h-[100dvh] bg-[#0B0F19] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111827] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="h-11 w-11 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 mb-3">
            <Trophy className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-white">{user ? 'Tu cuenta' : titles[mode]}</h1>
          <p className="text-xs text-gray-400 mt-1">
            Sincroniza tus inscripciones entre el móvil y el ordenador y mira quién más va.
          </p>
        </div>

        {!cloudEnabled ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 flex gap-3">
              <CloudOff className="w-5 h-5 text-orange-400 shrink-0" />
              <div>
                <p className="font-semibold text-white">Modo local</p>
                <p className="text-xs text-gray-400 mt-1">
                  La base de datos aún no está conectada: todo se guarda en este navegador. Para activarla, sigue la guía
                  «Base de datos (Supabase)» del README-SYNC.md.
                </p>
              </div>
            </div>
            <Button className="w-full" onClick={() => navigate('/')}>
              Seguir sin cuenta
            </Button>
          </div>
        ) : user ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-100">
              Conectado como <strong>{displayName(user)}</strong>
              <p className="text-xs text-emerald-200/70">{user.email}</p>
            </div>
            <Button className="w-full" onClick={() => navigate('/my-races')}>
              Ir a mis inscripciones
            </Button>
            <Button variant="secondary" className="w-full gap-2" onClick={() => signOut()}>
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <Label htmlFor="a-name">Nombre visible</Label>
                <Input id="a-name" required value={form.name} onChange={set('name')} placeholder="Como te verán en «¿Quién va?»" />
              </div>
            )}
            {mode !== 'reset' && (
              <div>
                <Label htmlFor="a-email">Email</Label>
                <Input id="a-email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} placeholder="tu@email.com" />
              </div>
            )}
            {mode !== 'forgot' && (
              <div>
                <Label htmlFor="a-pass">{mode === 'reset' ? 'Nueva contraseña' : 'Contraseña'}</Label>
                <Input
                  id="a-pass"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="••••••••"
                />
              </div>
            )}

            {msg && (
              <p className={`text-xs flex items-start gap-1.5 ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                {msg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                {msg.text}
              </p>
            )}

            <Button type="submit" className="w-full gap-2" disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {titles[mode]}
            </Button>

            <div className="flex justify-between text-xs">
              {mode === 'login' ? (
                <>
                  <button type="button" className="text-orange-400 hover:underline cursor-pointer" onClick={() => setMode('register')}>
                    Crear cuenta
                  </button>
                  <button type="button" className="text-gray-400 hover:underline cursor-pointer" onClick={() => setMode('forgot')}>
                    ¿Olvidaste la contraseña?
                  </button>
                </>
              ) : (
                <button type="button" className="text-orange-400 hover:underline cursor-pointer" onClick={() => setMode('login')}>
                  Ya tengo cuenta
                </button>
              )}
            </div>
            <Link to="/" className="block text-center text-xs text-gray-500 hover:text-gray-300">
              Seguir sin cuenta
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
