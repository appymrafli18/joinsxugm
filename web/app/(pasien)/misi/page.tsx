import type { Metadata } from "next";
import { MisiScreen } from "@/components/misi/MisiScreen";

export const metadata: Metadata = { title: "Misi | Vsikolog" };

export default function MisiPage() {
  return <MisiScreen />;
}