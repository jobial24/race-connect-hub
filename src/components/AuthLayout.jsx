import { ShieldCheck } from 'lucide-react';

export default function AuthLayout({ children, title, subtitle, icon: Icon = ShieldCheck }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-card p-8 rounded-3xl border border-border shadow-lg">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
            <Icon className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="mt-8">
          {children}
        </div>
      </div>
    </div>
  );
}