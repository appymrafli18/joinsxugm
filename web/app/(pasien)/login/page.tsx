import type { Metadata } from "next";
import { LoginScreen } from "@/components/auth/LoginScreen";

export const metadata: Metadata = { title: "Masuk | Vsikolog" };

export default function LoginPage() {
  return <LoginScreen />;
}