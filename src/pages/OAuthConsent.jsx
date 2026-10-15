import { ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
export default function OAuthConsent() {
  return <AuthLayout icon={ShieldCheck} title="Autorizar acceso" subtitle="Aplicación conectada correctamente" />;
}
