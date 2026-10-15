/**
 * Komponen panggilan LiveKit — hanya dimuat di perangkat dengan
 * development build (modul native). Jangan import file ini langsung
 * dari layar; gunakan require + try/catch agar Expo Go tetap aman
 * (lihat app/sesi/[bookingId].tsx).
 */
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AudioSession,
  LiveKitRoom,
  useLocalParticipant,
  useTracks,
  VideoTrack,
  isTrackReference,
} from '@livekit/react-native';
import { Track } from 'livekit-client';

import { ChevronLeftIcon, MicIcon, MicOffIcon } from '@/components/common/Icon';
import { COLORS } from '@/constants/colors';
import { FONT, RADIUS, SHADOW } from '@/constants/theme';

type PsychologistInfo = { nickname: string | null; avatar_url: string | null };

function MicToggle({ connected }: { connected: boolean }) {
  const { localParticipant } = useLocalParticipant();
  const [enabled, setEnabled] = useState(true);

  async function toggle() {
    try {
      await localParticipant.setMicrophoneEnabled(!enabled);
      setEnabled((value) => !value);
    } catch {
      // abaikan — biarkan sistem menangani
    }
  }

  return (
    <Pressable
      onPress={() => void toggle()}
      disabled={!connected}
      style={[styles.micButton, !enabled && styles.micOff]}
      accessibilityRole="button"
      accessibilityLabel={enabled ? 'Matikan mikrofon' : 'Nyalakan mikrofon'}
    >
      {enabled ? <MicIcon color={COLORS.white} size={20} /> : <MicOffIcon color={COLORS.white} size={20} />}
    </Pressable>
  );
}

function VoiceStage({ psychologist, connected }: { psychologist: PsychologistInfo; connected: boolean }) {
  const audioTracks = useTracks([Track.Source.Microphone], { onlySubscribed: true });
  const remoteSpeaking = audioTracks.length > 0;
  return (
    <View style={styles.voiceWrap}>
      <View style={styles.avatarWrap}>
        {psychologist.avatar_url ? (
          <Image source={{ uri: psychologist.avatar_url }} contentFit="cover" style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{(psychologist.nickname ?? 'P').slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <Text style={styles.name}>{psychologist.nickname ?? 'Psikolog'}</Text>
      <Text style={styles.status}>
        {!connected
          ? 'Menyambungkan…'
          : remoteSpeaking
            ? 'Sedang berbicara…'
            : 'Tersambung · panggilan suara'}
      </Text>
      <Text style={styles.hint}>
        Ini sesi dengan psikolog asli (bukan AI). Semua pembicaraan berlangsung langsung.
      </Text>
      <MicToggle connected={connected} />
    </View>
  );
}

function VideoStage({ psychologist, connected }: { psychologist: PsychologistInfo; connected: boolean }) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const remote = tracks.find(isTrackReference);
  return (
    <View style={styles.videoWrap}>
      {remote ? (
        <VideoTrack trackRef={remote} style={styles.video} />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Text style={styles.status}>
            {connected ? `Menunggu video ${psychologist.nickname ?? 'psikolog'}…` : 'Menyambungkan…'}
          </Text>
        </View>
      )}
      <View style={styles.videoFooter}>
        <Text style={styles.videoLabel}>{psychologist.nickname ?? 'Psikolog'}</Text>
        <MicToggle connected={connected} />
      </View>
    </View>
  );
}

export function CallRoom({
  url,
  token,
  mode,
  psychologist,
  onLeave,
}: {
  url: string;
  token: string;
  mode: 'voice' | 'video';
  psychologist: PsychologistInfo;
  onLeave: () => void;
}) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    void AudioSession.startAudioSession().catch(() => {});
    return () => {
      void AudioSession.stopAudioSession().catch(() => {});
    };
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onLeave} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Akhiri sesi">
          <ChevronLeftIcon color={COLORS.white} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {mode === 'video' ? 'Sesi Video' : 'Sesi Suara'}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <LiveKitRoom
        serverUrl={url}
        token={token}
        connect
        audio
        video={mode === 'video'}
        onConnected={() => setConnected(true)}
        onDisconnected={() => setConnected(false)}
      >
        <View style={styles.room}>
          {mode === 'video' ? (
            <VideoStage psychologist={psychologist} connected={connected} />
          ) : (
            <VoiceStage psychologist={psychologist} connected={connected} />
          )}
        </View>
      </LiveKitRoom>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#241E33' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONT, fontSize: 14, color: COLORS.white },
  room: { flex: 1 },
  /* Voice */
  voiceWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 28 },
  avatarWrap: { marginBottom: 6 },
  avatar: { width: 168, height: 168, borderRadius: 84, backgroundColor: '#3A3150' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: FONT, fontSize: 56, color: COLORS.white },
  name: { fontFamily: FONT, fontSize: 20, color: COLORS.white },
  status: { fontFamily: FONT, fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  hint: {
    fontFamily: FONT,
    fontSize: 10,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 14,
  },
  micButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.cta,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.cta,
  },
  micOff: { backgroundColor: 'rgba(255,255,255,0.25)' },
  /* Video */
  videoWrap: { flex: 1 },
  video: { flex: 1, backgroundColor: '#000' },
  videoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  videoFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  videoLabel: {
    fontFamily: FONT,
    fontSize: 12,
    color: COLORS.white,
    backgroundColor: 'rgba(36,30,51,0.7)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: 'hidden',
  },
});
