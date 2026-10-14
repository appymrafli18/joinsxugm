import { readJson, removeStorage } from './storage';
import { supabase } from './supabase';
import type { ArchetypeId } from '@/constants/colors';

export type { ArchetypeId };
export const SCREENING_STORAGE_KEY = 'vsikolog:screening-answers';
export type RouteResult = { ok: true; route: string } | { ok: false; reason: 'not_patient' | 'failed' };

export async function saveScreeningFromStorage() {
  try {
    const parsed = await readJson<unknown>(SCREENING_STORAGE_KEY);
    if (!parsed) return true;
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      await removeStorage(SCREENING_STORAGE_KEY);
      return false;
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) return false;
    const answers: Record<string, number> = {};
    parsed.forEach((value, index) => { answers[`q${index + 1}`] = value; });
    const total = parsed.reduce((sum, value) => sum + value, 0);
    const { error } = await supabase.from('screening_scores').insert({ patient_id: data.user.id, answers, total });
    if (error) return false;
    await removeStorage(SCREENING_STORAGE_KEY);
    return true;
  } catch { return false; }
}

export async function saveArchetype(archetype: ArchetypeId) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;
    const { data, error } = await supabase.from('patients').update({ archetype_id: archetype }).eq('id', userData.user.id).select('id');
    return !error && (data?.length ?? 0) === 1;
  } catch { return false; }
}

export async function resolvePatientRoute(): Promise<RouteResult> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { ok: false, reason: 'failed' };
    const { data: patient, error } = await supabase.from('patients').select('archetype_id').eq('id', userData.user.id).maybeSingle();
    if (error) return { ok: false, reason: 'failed' };
    if (!patient) return { ok: false, reason: 'not_patient' };
    return { ok: true, route: patient.archetype_id ? '/beranda' : '/pilih-arketipe' };
  } catch { return { ok: false, reason: 'failed' }; }
}

export async function resolveStartRoute() {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return '/onboarding';
    const result = await resolvePatientRoute();
    return result.ok ? result.route : '/onboarding';
  } catch { return '/onboarding'; }
}
