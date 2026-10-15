import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [success, setSuccess] = useState(false);
  return (
    <AuthLayout icon={Lock} title="Nueva contraseña" subtitle="Introduce tu nueva contraseña">
      {success ? <p className="text-center text-sm">Contraseña actualizada. <Link to="/login" className="text-primary underline">Entrar</Link></p> :
      <form onSubmit={(e) => { e.preventDefault(); setSuccess(true); }} className="space-y-4"><div><Label>Nueva contraseña</Label><Input type="password" required className="h-12 rounded-xl mt-1" /></div><Button type="submit" className="w-full h-12 rounded-xl">Actualizar</Button></form>}
    </AuthLayout>
  );
}
