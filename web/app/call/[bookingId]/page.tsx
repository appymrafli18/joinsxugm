"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

/**
 * Halaman panggilan LiveKit (browser) — dipakai via `/api/calls/link`.
 *
 * Membawa token di query (`t`), URL server (`s`), nama (`n`), mode (`mode`).
 * Berguna untuk klien tanpa modul native (mis. Expo Go): panggilan tetap bisa
 * dicoba lewat browser. Token berumur pendek & hanya untuk room sesi tsb.
 */

export const dynamic = "force-dynamic";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60";

export default function CallPage() {
  const params = useParams<{ bookingId: string }>();
  const search = useSearchParams();
  const token = search.get("t") ?? "";
  const serverUrl = search.get("s") ?? "";
  const name = search.get("n") ?? "Peserta";
  const mode = search.get("mode") === "voice" ? "voice" : "video";

  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(mode === "video");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roomRef = useRef<any>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const remoteAudioRef = useRef<HTMLDivElement>(null);

  const missing = !token || !serverUrl;

  const leave = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      try {
        void room.disconnect();
      } catch {
        // abaikan
      }
      roomRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = "";
    if (remoteAudioRef.current) remoteAudioRef.current.innerHTML = "";
    setJoined(false);
    setConnecting(false);
  }, []);

  useEffect(() => () => leave(), [leave]);

  async function join() {
    if (connecting || joined || missing) return;
    setConnecting(true);
    setError(null);
    try {
      const { Room, RoomEvent, Track } = await import("livekit-client");
      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track: unknown) => {
        const t = track as { kind: string; attach: () => HTMLMediaElement };
        const element = t.attach();
        if (t.kind === Track.Kind.Video && remoteVideoRef.current) remoteVideoRef.current.appendChild(element);
        else if (t.kind === Track.Kind.Audio && remoteAudioRef.current) remoteAudioRef.current.appendChild(element);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track: unknown) => {
        const t = track as { detach: () => HTMLMediaElement[] };
        t.detach().forEach((el) => el.remove());
      });
      room.on(RoomEvent.Disconnected, () => leave());
      await room.connect(serverUrl, token);
      if (mode === "video") {
        await room.localParticipant.enableCameraAndMicrophone();
        setCamOn(true);
      } else {
        await room.localParticipant.setMicrophoneEnabled(true);
      }
      setMuted(false);
      setJoined(true);
      setConnecting(false);
    } catch (e) {
      console.error("[call] gagal bergabung:", e);
      setError("Gagal bergabung ke panggilan. Izinkan kamera/mikrofon lalu coba lagi.");
      leave();
    }
  }

  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }

  async function toggleCam() {
    const room = roomRef.current;
    if (!room) return;
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#241E33] text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <p className="font-display text-[15px]">
          {mode === "video" ? "Sesi Video" : "Sesi Suara"}
        </p>
        <p className="text-[12px] text-white/60">{name} · booking {String(params?.bookingId ?? "").slice(0, 8)}</p>
      </header>

      <div className="relative flex flex-1 items-center justify-center px-4">
        {joined ? (
          <div
            ref={remoteVideoRef}
            className="flex h-[60vh] w-full max-w-3xl items-center justify-center overflow-hidden rounded-xl2 bg-black/40 [&>video]:max-h-full [&>video]:w-full [&>video]:object-contain"
          />
        ) : (
          <div className="max-w-md text-center">
            <p className="font-display text-lg">Panggilan dengan {name}</p>
            {missing ? (
              <p className="mt-3 text-[13px] text-[#FFB4A6]">
                Tautan tidak lengkap. Buka tautan panggilan dari aplikasi Vsikolog.
              </p>
            ) : (
              <>
                <p className="mt-3 text-[13px] text-white/70">
                  Kamu akan bergabung ke ruang konsultasi. Izinkan kamera & mikrofon bila diminta.
                </p>
                <button
                  type="button"
                  onClick={() => void join()}
                  disabled={connecting}
                  className={`mt-5 h-12 rounded-full bg-cta px-7 text-[14px] font-display disabled:opacity-50 ${FOCUS_RING}`}
                >
                  {connecting ? "Menyambungkan…" : "Gabung Panggilan"}
                </button>
              </>
            )}
            {error && <p className="mt-3 text-[12px] text-[#FFB4A6]">{error}</p>}
          </div>
        )}
        <div ref={remoteAudioRef} className="hidden" />
      </div>

      {joined && (
        <div className="flex items-center justify-center gap-3 px-4 pb-6">
          <button
            type="button"
            onClick={() => void toggleMute()}
            className={`h-11 rounded-full px-5 text-[13px] ${muted ? "bg-white/25" : "bg-white/10"}`}
          >
            {muted ? "Mikrofon mati" : "Mikrofon hidup"}
          </button>
          {mode === "video" && (
            <button
              type="button"
              onClick={() => void toggleCam()}
              className={`h-11 rounded-full px-5 text-[13px] ${camOn ? "bg-white/10" : "bg-white/25"}`}
            >
              {camOn ? "Kamera hidup" : "Kamera mati"}
            </button>
          )}
          <button type="button" onClick={leave} className="h-11 rounded-full bg-terracotta px-6 text-[13px]">
            Akhiri
          </button>
        </div>
      )}
    </div>
  );
}
