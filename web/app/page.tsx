import { redirect } from "next/navigation";

/** Website = portal Admin & Psikolog. Pasien memakai aplikasi mobile. */
export default function Home() {
  redirect("/portal");
}
