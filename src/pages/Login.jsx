import React, { useState } from "react";
import { Link } from "react-router-dom";
import { db } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, Eye, EyeOff, ShieldCheck, UserCheck } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const returnTo = safeReturnTo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await db.auth.loginViaEmailPassword(email.trim(), password);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Correo o contraseña incorrectos.");
    } finally { setLoading(false); }
  };

  const handleQuickDemo = async (role) => {
    const demoEmail = role === "admin" ? "admin@raceconnect.app" : "corredor@raceconnect.app";
    await db.auth.loginViaEmailPassword(demoEmail, "demo1234");
    window.location.href = returnTo;
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Iniciar sesión"
      subtitle="Accede a tu cuenta en Race Connect Hub"
      footer={<span className="text-sm">¿Sin cuenta? <Link to="/register" className="text-primary font-semibold hover:underline">Regístrate</Link></span>}
    >
      {error && <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm font-medium">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><Label>Correo</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 rounded-xl mt-1" /></div>
        <div><Label>Contraseña</Label><Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 rounded-xl mt-1" /></div>
        <Button type="submit" className="w-full h-12 rounded-xl font-semibold" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Entrar"}</Button>
      </form>
      <div className="mt-6 pt-5 border-t border-border grid grid-cols-2 gap-2">
        <button onClick={() => handleQuickDemo("admin")} className="py-2 px-3 rounded-xl border bg-muted/40 text-xs font-medium flex items-center justify-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-primary" /> Admin</button>
        <button onClick={() => handleQuickDemo("user")} className="py-2 px-3 rounded-xl border bg-muted/40 text-xs font-medium flex items-center justify-center gap-1"><UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Corredor</button>
      </div>
    </AuthLayout>
  );
}
