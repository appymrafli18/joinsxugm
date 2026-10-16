"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";

import { portalFetch } from "@/lib/portalClient";
import { supabase } from "@/lib/supabaseClient";

/**
 * Halaman sesi psikolog (portal web): chat teks + panggilan LiveKit
 * (suara/video) untuk satu booking. Pasien memakai layar setara di mobile.
 *
 * Chat: langsung ke Supabase (`session_messages`, RLS peserta) + Realtime,
 * dengan polling berkala sebagai fallback. Panggilan: token dari
 * `/api/calls/token`, lalu `livekit-client` (di-import dinamis agar aman SSR).
 */

type SessionBootstrap = {
  booking: {
    id: string;
    patient_id: string;
    psychologist_id: string;
    scheduled_at: string;
    status: string;
    paid_with: string;
    payment_status: string;
    price: number;
    points_used: number;
    duration_minutes: number;
    session_mode: "voice" | "video";
    patient_note: string | null;
  };
  role: "patient" | "psychologist" | "admin";
  me: { id: string; name: string };
  counterpart: { id: string; name: string; avatar_url: string | null };
  canCall: boolean;
  callMode: "voice" | "video";
  canChat: boolean;
};

type Message = {
  id: string;
  sender_id: string;
  sender_role: "patient" | "psychologist";
  content: string;
  created_at: string;
};

type Brief = {
  consent: boolean;
  summary: { text: string; date: string } | null;
  sentiment: { stabil: number; cemas: number; date: string } | null;
  reason?: string;
};

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text/60";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function PortalSesiPage() {
  const router = useRouter();
  const params = useParams<{ bookingId: string }>();
  const bookingId = String(params?.bookingId ?? "");

  const [session, setSession] = useState<SessionBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Chat */
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* Panggilan */
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roomRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLDivElement>(null);

  /* Ringkasan AI pra-sesi (briefing) */
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  /* ---------- Bootstrap ---------- */
  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    void portalFetch<SessionBootstrap>(`/api/session?bookingId=${encodeURIComponent(bookingId)}`).then(
      (result) => {
        if (!active) return;
        if (!result.ok) {
          if (result.status === 401) {
            router.replace("/portal");
            return;
          }
          setError(result.message);
          return;
        }
        setSession(result.data);
      },
    );
    return () => {
      active = false;
    };
  }, [bookingId, router]);

  /* ---------- Ringkasan AI pra-sesi (hanya bila consent pasien aktif) ---------- */
  useEffect(() => {
    if (!session) return;
    let active = true;
    setBriefLoading(true);
    void portalFetch<Brief>(`/api/session/summary?bookingId=${encodeURIComponent(bookingId)}`).then((result) => {
      if (!active) return;
      setBriefLoading(false);
      if (result.ok) setBrief(result.data);
    });
    return () => {
      active = false;
    };
  }, [session, bookingId]);

  async function generateBrief() {
    if (generating) return;
    setGenerating(true);
    setBriefError(null);
    const result = await portalFetch<Brief>("/api/session/summary", { method: "POST", body: { bookingId } });
    setGenerating(false);
    if (!result.ok) {
      setBriefError(result.message);
      return;
    }
    if (!result.data.summary) setBriefError(result.data.reason ?? "Belum cukup pesan untuk dirangkum.");
    setBrief(result.data);
  }

  /* ---------- Chat: muat + realtime + polling ---------- */
  const loadMessages = useCallback(async () => {
    if (!bookingId) return;
    const result = await portalFetch<{ messages: Message[] }>(
      `/api/session/messages?bookingId=${encodeURIComponent(bookingId)}`,
    );
    if (result.ok) setMessages(result.data.messages ?? []);
  }, [bookingId]);

  useEffect(() => {
    if (!session) return;
    void loadMessages();
    const channel = supabase
      .channel(`session-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "session_messages", filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const row = payload.new as Message;
          setMessages((current) => (current.some((m) => m.id === row.id) ? current : [...current, row]));
        },
      )
      .subscribe();
    const poll = setInterval(() => void loadMessages(), 5000);
    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [session, bookingId, loadMessages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setChatError(null);
    const result = await portalFetch<{ message: Message }>("/api/session/messages", {
      method: "POST",
      body: { bookingId, content: content.slice(0, 2000) },
    });
    setSending(false);
    if (!result.ok) {
      setChatError(result.message);
      return;
    }
    setInput("");
    void loadMessages();
  }

  /* ---------- Panggilan ---------- */
  const stopCall = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      try {
        void room.disconnect();
      } catch {
        // abaikan
      }
      roomRef.current = null;
    }
    if (videoRef.current) videoRef.current.innerHTML = "";
    if (audioRef.current) audioRef.current.innerHTML = "";
    setCallActive(false);
    setConnecting(false);
  }, []);

  useEffect(() => () => stopCall(), [stopCall]);

  async function startCall() {
    if (!session || connecting || callActive) return;
    setConnecting(true);
    setCallError(null);
    const tokenResult = await portalFetch<{
      url: string;
      token: string;
      mode: "voice" | "video";
    }>("/api/calls/token", { method: "POST", body: { bookingId } });
    if (!tokenResult.ok) {
      setCallError(tokenResult.message);
      setConnecting(false);
      return;
    }
    try {
      // Import dinamis: aman untuk SSR dan tidak membundel LiveKit bila tak dipakai.
      const { Room, RoomEvent, Track } = await import("livekit-client");
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: unknown) => {
        const t = track as { kind: string; attach: () => HTMLMediaElement };
        const element = t.attach();
        if (t.kind === Track.Kind.Video && videoRef.current) {
          videoRef.current.appendChild(element);
        } else if (t.kind === Track.Kind.Audio && audioRef.current) {
          audioRef.current.appendChild(element);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track: unknown) => {
        const t = track as { detach: () => HTMLMediaElement[] };
        t.detach().forEach((el) => el.remove());
      });
      room.on(RoomEvent.Disconnected, () => stopCall());

      await room.connect(tokenResult.data.url, tokenResult.data.token);
      await room.localParticipant.enableCameraAndMicrophone();
      setCamOn(true);
      setMuted(false);
      setCallActive(true);
      setConnecting(false);
    } catch (e) {
      console.error("[portal/sesi] gagal panggilan:", e);
      setCallError("Gagal memulai panggilan. Cek kamera/mikrofon & konfigurasi LiveKit.");
      stopCall();
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

  /* ---------- Render ---------- */
  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-text/70">{error}</p>
        <button
          type="button"
          onClick={() => router.replace("/portal/psikolog")}
          className={`mt-6 h-11 rounded-full bg-cta px-6 text-sm text-white ${FOCUS_RING}`}
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-text/60">Memuat sesi…</p>
      </div>
    );
  }

  const { booking, counterpart, canCall, callMode, canChat } = session;
  const statusLabel = booking.status === "cancelled" ? "Dibatalkan" : booking.status === "completed" ? "Selesai" : booking.status;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.replace("/portal/psikolog")}
          className={`h-10 rounded-full bg-white px-5 text-[12px] shadow-float ring-1 ring-guardian/15 ${FOCUS_RING}`}
        >
          ← Dashboard
        </button>
        <div className="text-right">
          <p className="font-display text-[15px]">{counterpart.name}</p>
          <p className="text-[11px] text-text/60">
            {formatTime(booking.scheduled_at)} · {callMode === "video" ? "video" : "suara"} · {statusLabel}
          </p>
        </div>
      </header>

      {/* Ringkasan AI pra-sesi (PRD §7.4, §12.5) */}
      <section className="mt-4 rounded-xl2 bg-white p-4 shadow-float">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-[14px]">
            Ringkasan AI{" "}
            <span className="text-[10px] italic text-text/50">— referensi awal, bukan diagnosis</span>
          </h2>
          {brief?.summary && <span className="text-[10px] text-text/50">{brief.summary.date}</span>}
        </div>
        {briefLoading ? (
          <p className="mt-2 text-[12px] text-text/50">Memuat ringkasan…</p>
        ) : !brief || !brief.consent ? (
          <p className="mt-2 text-[12px] text-text/60">Menunggu consent pasien — ringkasan AI belum bisa dibagikan.</p>
        ) : brief.summary ? (
          <>
            <p className="mt-2 text-[12px] leading-relaxed text-text/85">{brief.summary.text}</p>
            {brief.sentiment && (
              <p className="mt-2 text-[11px] text-text/60">
                Sentimen terbaru ({brief.sentiment.date}): stabil {brief.sentiment.stabil} / cemas {brief.sentiment.cemas}
              </p>
            )}
          </>
        ) : (
          <div className="mt-2">
            <p className="text-[12px] text-text/60">
              Belum ada ringkasan. Buat sekarang dari pesan terakhir pasien (sekali, tersimpan).
            </p>
            <button
              type="button"
              onClick={() => void generateBrief()}
              disabled={generating}
              className={`mt-2 h-9 rounded-full bg-cta px-4 text-[12px] text-white disabled:opacity-40 ${FOCUS_RING}`}
            >
              {generating ? "Membuat…" : "Buat ringkasan sekarang"}
            </button>
          </div>
        )}
        {briefError && <p className="mt-2 text-[11px] text-[#8F3A57]">{briefError}</p>}
      </section>

      {/* Area panggilan */}
      <section className="mt-4 overflow-hidden rounded-xl2 bg-[#241E33] shadow-float">
        <div className="relative flex min-h-[240px] items-center justify-center">
          {callActive ? (
            <>
              <div ref={videoRef} className="flex h-full w-full items-center justify-center [&>video]:max-h-[420px] [&>video]:w-full [&>video]:object-contain" />
              {callMode === "voice" && (
                <div className="pointer-events-none absolute flex flex-col items-center gap-2 text-center text-white">
                  {counterpart.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={counterpart.avatar_url} alt="" className="h-28 w-28 rounded-full object-cover ring-4 ring-white/20" />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/10 font-display text-3xl">
                      {counterpart.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <p className="text-[13px]">{counterpart.name}</p>
                  <p className="text-[11px] text-white/60">Panggilan suara — audio dari psikolog asli</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 text-center text-white">
              <p className="font-display text-[15px]">{counterpart.name}</p>
              {canCall ? (
                <>
                  <p className="text-[11px] text-white/70">
                    Mulai panggilan {callMode === "video" ? "video" : "suara"} — {counterpart.name} menyambung dari aplikasi.
                  </p>
                  <button
                    type="button"
                    onClick={() => void startCall()}
                    disabled={connecting}
                    className={`mt-2 h-11 rounded-full bg-cta px-6 text-[13px] text-white shadow-float disabled:opacity-50 ${FOCUS_RING}`}
                  >
                    {connecting ? "Menyambungkan…" : callMode === "video" ? "Mulai Panggilan Video" : "Mulai Panggilan Suara"}
                  </button>
                </>
              ) : (
                <p className="text-[11px] text-white/70">
                  Sesi belum terkonfirmasi. Konfirmasi booking dulu untuk memulai panggilan.
                </p>
              )}
              {callError && <p className="mt-2 text-[11px] text-[#FFB4A6]">{callError}</p>}
            </div>
          )}
          <div ref={audioRef} className="hidden" />
        </div>

        {callActive && (
          <div className="flex items-center justify-center gap-3 pb-4">
            <button
              type="button"
              onClick={() => void toggleMute()}
              className={`h-10 rounded-full px-5 text-[12px] text-white ${muted ? "bg-white/20" : "bg-white/10"}`}
            >
              {muted ? "Mikrofon mati" : "Mikrofon hidup"}
            </button>
            {callMode === "video" && (
              <button
                type="button"
                onClick={() => void toggleCam()}
                className={`h-10 rounded-full px-5 text-[12px] text-white ${camOn ? "bg-white/10" : "bg-white/20"}`}
              >
                {camOn ? "Kamera hidup" : "Kamera mati"}
              </button>
            )}
            <button type="button" onClick={stopCall} className="h-10 rounded-full bg-terracotta px-5 text-[12px] text-white">
              Akhiri
            </button>
          </div>
        )}
      </section>

      {/* Chat */}
      {canChat ? (
        <section className="mt-5 flex min-h-[320px] flex-1 flex-col rounded-xl2 bg-white p-4 shadow-float">
          <h2 className="font-display text-[15px]">Chat Sesi</h2>
          <p className="mt-1 text-[11px] text-text/60">
            Pesan hanya terlihat oleh kamu dan {counterpart.name} (bukan AI).
          </p>
          <div ref={listRef} className="mt-3 flex max-h-[360px] flex-1 flex-col gap-2 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-[12px] text-text/50">Belum ada pesan. Sapa pasien untuk memulai.</p>
            )}
            {messages.map((m) => {
              const mine = m.sender_role === "psychologist";
              return (
                <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-[12px] ${mine ? "self-end bg-cta text-white" : "self-start bg-base text-text"}`}>
                  {m.content}
                  <span className={`mt-1 block text-[9px] ${mine ? "text-white/70" : "text-text/40"}`}>
                    {formatTime(m.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
          {chatError && <p className="mt-2 text-[11px] text-[#8F3A57]">{chatError}</p>}
          <form onSubmit={sendMessage} className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tulis pesan untuk pasien…"
              maxLength={2000}
              className={`h-11 flex-1 rounded-full bg-base px-4 text-[13px] ring-1 ring-guardian/20 outline-none focus:ring-2 focus:ring-guardian ${FOCUS_RING}`}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className={`h-11 rounded-full bg-cta px-6 text-[13px] text-white disabled:opacity-40 ${FOCUS_RING}`}
            >
              Kirim
            </button>
          </form>
        </section>
      ) : (
        <p className="mt-5 rounded-xl2 bg-healer-card px-4 py-3 text-[12px] text-[#8F3A57]">Sesi ini sudah dibatalkan.</p>
      )}
    </div>
  );
}
