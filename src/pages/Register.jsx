import React, { useState } from "react";
import { Link } from "react-router-dom";
import { db } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const returnTo = safeReturnTo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await db.auth.register({ email, password, full_name: fullName });
      window.location.href = returnTo;
    } catch (err) { setError("Error en el registro."); }
    finally { setLoading(false); }
  };

  return (
    <AuthLayout icon={UserPlus} title="Crea tu cuenta" subtitle="Únete a Race Connect Hub" footer={<span className="text-sm">¿Tienes cuenta? <Link to="/login" className="text-primary font-semibold">Entrar</Link></span>}>
      {error && <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><Label>Nombre</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-12 rounded-xl mt-1" /></div>
        <div><Label>Correo</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 rounded-xl mt-1" /></div>
        <div><Label>Contraseña</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 rounded-xl mt-1" /></div>
        <Button type="submit" className="w-full h-12 rounded-xl font-semibold" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Registrarse"}</Button>
      </form>
    </AuthLayout>
  );
}
