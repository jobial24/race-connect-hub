import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111827] border border-white/10 rounded-2xl p-8 space-y-6">
        <Link to="/login" className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al login</span>
        </Link>

        <div>
          <h1 className="text-xl font-bold text-white">Recuperar Contraseña</h1>
          <p className="text-xs text-gray-400 mt-1">Te enviaremos un correo para restablecer tu cuenta.</p>
        </div>

        {submitted ? (
          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-xs text-orange-300">
            Si la cuenta existe, hemos enviado un enlace de recuperación a tu correo.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
              />
            </div>

            <Button type="submit" className="w-full">
              Enviar Instrucciones
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
