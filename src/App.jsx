import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Home from '@/pages/Home';
import AdminRaces from '@/pages/AdminRaces';
import RaceDetail from '@/pages/RaceDetail';
import MyRaces from '@/pages/MyRaces';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import OAuthConsent from '@/pages/OAuthConsent';
import { Trophy, Shield, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/api/client';

function Navbar() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await db.auth.logout();
    setUser(null);
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-sm">
            <Trophy className="w-5 h-5" />
          </div>
          <span>Race Connect <span className="text-primary">Hub</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/" className="hover:text-primary transition">Calendario</Link>
          {user && <Link to="/mis-carreras" className="hover:text-primary transition">Mis Carreras</Link>}
          {user?.role === 'admin' && (
            <Link to="/admin" className="inline-flex items-center gap-1 text-primary hover:underline">
              <Shield className="w-3.5 h-3.5" /> Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold hidden sm:inline-block bg-muted px-3 py-1.5 rounded-full">
                {user.full_name || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-muted transition">
                Entrar
              </Link>
              <Link to="/register" className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition shadow-sm">
                Registro
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/25">
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:py-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/carrera/:id" element={<RaceDetail />} />
              <Route path="/mis-carreras" element={<PrivateRoute><MyRaces /></PrivateRoute>} />
              <Route path="/admin" element={<PrivateRoute adminOnly><AdminRaces /></PrivateRoute>} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/oauth/consent" element={<OAuthConsent />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
            <p>© 2026 Race Connect Hub. Plataforma independiente para corredores de asfalto, trail y OCR.</p>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}