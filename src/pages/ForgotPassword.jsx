import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  return (
    <AuthLayout icon={Mail} title="Recuperar contraseña" subtitle="Te enviaremos un enlace" footer={<Link to="/login" className="text-primary"><ArrowLeft className="w-3 h-3 inline mr-1" /> Volver</Link>}>
      {sent ? <p className="text-sm text-center">¡Correo enviado con éxito!</p> : <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4"><div><Label>Correo</Label><Input type="email" required className="h-12 rounded-xl mt-1" /></div><Button type="submit" className="w-full h-12 rounded-xl">Enviar enlace</Button></form>}
    </AuthLayout>
  );
}
