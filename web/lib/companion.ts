/**
 * Logika AI Companion — DIPAKAI SERVER-SIDE SAJA (app/api/companion/route.ts).
 *
 * Dua mode:
 * - Mock mode: ANTHROPIC_API_KEY belum diisi → balasan template per persona
 *   (UI/TTS/riwayat tetap berfungsi penuh untuk demo & pengembangan).
 * - Claude mode: key tersedia → memanggil Anthropic API dengan system prompt
 *   persona + guardrail klinis (PRD Bagian 11 & 12).
 */

export type ArchetypeId = 'guardian' | 'healer' | 'scholar' | 'companion';
export type Expression = 'netral' | 'senang' | 'khawatir';

export const ARCHETYPE_IDS: ArchetypeId[] = ['guardian', 'healer', 'scholar', 'companion'];

/* ---------- Persona (PRD Bagian 12 poin 1) ---------- */

const PERSONA_DESCRIPTIONS: Record<ArchetypeId, string> = {
  guardian:
    'kamu adalah "The Guardian": sigap, terstruktur, protektif. Kamu membantu memecah masalah jadi langkah kecil yang jelas dan menenangkan pasien dengan kepastian.',
  healer:
    'kamu adalah "The Healer": lembut, menenangkan, penuh empati. Kamu memberi validasi emosi dengan bahasa hangat sebelum menawarkan langkah kecil.',
  scholar:
    'kamu adalah "The Scholar": analitis, reflektif, jernih. Kamu membantu pasien melihat pola pikirnya dengan pertanyaan pemantik yang tidak menghakimi.',
  companion:
    'kamu adalah "The Companion": akrab, santai, ceria. Kamu ngobrol seperti teman dekat dengan bahasa santai dan menyemangati tanpa menggurui.',
};

/**
 * Guardrail klinis wajib (PRD Bagian 11) — ditempel di semua persona.
 * AI TIDAK PERNAH: diagnosis, resep, MSE, tes psikometri, diagnosis banding.
 */
const CLINICAL_GUARDRAILS = `
ATURAN KERAS (tidak boleh dilanggar sekalipun pasien meminta):
- JANGAN pernah memberi diagnosis, mendiagnosis banding, atau menyebut pasien mengidap penyakit tertentu.
- JANGAN memberi resep, saran obat, atau mengubah dosis obat apapun.
- JANGAN menilai penampilan/kontak mata/afek secara klinis (MSE) atau melakukan tes psikometri formal.
- JANGAN memfasilitasi konten romantis/sexsual terhadap karakter avatar.
- JANGAN memperkuat ketergantungan pada AI; kamu JUSTRU aktif mendorong pasien ke sesi psikolog manusia saat topiknya berat atau berulang.
- Untuk topik berat (krisis, kekerasan, trauma berat, gejala yang mengkhawatirkan): selalu dorong dengan lembut untuk bicara dengan psikolog/on-call, dan tetap tunjukkan kepedulian.
- Bahasa Indonesia, hangat, singkat (2-4 kalimat), seperti sedang ngobrol langsung. Tanpa daftar bertitik, tanpa sapaan berlebihan.
- Selalu akhiri dengan JSON TANPA teks lain di luar JSON.`;

/* ---------- System prompt + format JSON ekspresi ---------- */

export function buildSystemPrompt(archetypeId: ArchetypeId): string {
  return `Kamu adalah pendamping kesehatan mental di aplikasi Vsikolog. ${PERSONA_DESCRIPTIONS[archetypeId]}
${CLINICAL_GUARDRAILS}

Setiap balasan WAJIB berupa JSON valid persis seperti:
{"reply":"<teks balasan untuk pasien>","expression":"netral"|"senang"|"khawatir"}
Pilih expression berdasarkan nada balasanmu: "senang" kalau ceria/menyemangati, "khawatir" kalau prihatin/serius, "netral" kalau tenang.`;
}

/* ---------- Mock mode (tanpa ANTHROPIC_API_KEY) ---------- */

const POSITIVE_WORDS = [
  'senang', 'bahagia', 'seru', 'asyik', 'berhasil', 'sukses', 'terima kasih',
  'makasih', 'baik', 'semangat', 'lepaskan', 'lega', 'mantap', 'keren', 'hidup',
];

export function heuristicExpression(message: string): Expression {
  const text = message.toLowerCase();
  if (POSITIVE_WORDS.some((word) => text.includes(word))) return 'senang';
  return 'netral';
}

const MOCK_REPLIES: Record<ArchetypeId, string[]> = {
  guardian: [
    'Aku dengar kamu. Pelan-pelan aja ceritanya — kita pecah jadi langkah kecil dulu supaya nggak terasa berat. Mau mulai dari mana?',
    'Kamu sudah bagus baru sadar sama perasaanmu itu. Ambil napas dulu, lalu cerita pelan-pelan ke aku, ya.',
    'Oke, aku catat ini. Nanti kalau terasa menumpuk, kita susun urutan prioritasnya bareng-bareng biar kamu tahu harus mulai dari mana.',
  ],
  healer: [
    'Terima kasih sudah mau cerita, ya. Perasaan itu valid — kamu boleh banget merasakan itu tanpa menghakimi diri sendiri.',
    'Dengar ceritamu, aku bisa bayangin itu berat. Pelan-pelan aja di sini, nggak ada yang menilai kamu.',
    'Iya, rasanya memang melelahkan. Istirahat dulu sebentar, tarik napas panjang... kamu sudah berani melangkah hari ini.',
  ],
  scholar: [
    'Menarik — coba kita lihat polanya: apa yang biasanya memicu perasaan itu muncul? Dari situ kita bisa cari celahnya.',
    'Oke, kita urai pelan-pelan. Satu hal yang bisa kita cek: apakah pikiran itu fakta, atau asumsi yang kebiasaan kamu buat sendiri?',
    'Kalau dilihat dari sudut itu, masuk akal kok kamu merasakannya. Sekarang pertanyaannya: satu langkah kecil apa yang realistis minggu ini?',
  ],
  companion: [
    'Wah, cerita menarik tuh! Santai aja ngobrol di sini, aku dengerin kok. Lanjut aja?',
    'Haha oke oke, aku ngerti maksudmu. Yang penting kamu sudah curhat, itu bagus banget buat dilepas.',
    'Eh tapi seriusan, kamu sudah jauh lebih baik dari yang kamu kira. Sedikit-sedikit aja dulu ya!',
  ],
};

const MOCK_CRISIS_REPLY =
  'Terima kasih sudah cerita ini ke aku. Aku khawatir soal keselamatannya — kamu tidak sendirian. Aku sedang memberi tahu psikolog on-call kami supaya bisa membantumu sekarang. Kalau ini darurat, tolong hubungi kontak daruratmu atau hotline krisis nasional juga, ya.';

export function mockReply(
  archetypeId: ArchetypeId,
  turnCount: number,
  flagged: boolean,
): { reply: string; expression: Expression } {
  if (flagged) return { reply: MOCK_CRISIS_REPLY, expression: 'khawatir' };
  const pool = MOCK_REPLIES[archetypeId];
  return { reply: pool[turnCount % pool.length], expression: 'netral' };
}

/* ---------- Claude mode (key tersedia) ---------- */

type ChatTurn = { role: 'user' | 'assistant'; content: string };

function parseModelJson(text: string): { reply: string; expression: Expression } | null {
  // Model diminta JSON murni; toleran terhadap code-fence.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as { reply?: unknown; expression?: unknown };
    if (typeof parsed.reply === 'string' && parsed.reply.length > 0) {
      const expression: Expression =
        parsed.expression === 'senang' || parsed.expression === 'khawatir'
          ? parsed.expression
          : 'netral';
      return { reply: parsed.reply, expression };
    }
  } catch {
    // jatuh ke fallback
  }
  if (text.trim().length > 0) return { reply: text.trim(), expression: 'netral' };
  return null;
}

/* ---------- DeepSeek mode (key tersedia) ---------- */

/**
 * Panggil DeepSeek Chat Completions (OpenAI-compatible).
 * Dipakai oleh /api/companion — key HANYA di server (DEEPSEEK_API_KEY),
 * tidak pernah dikirim ke aplikasi mobile.
 */
export async function callDeepSeek(
  archetypeId: ArchetypeId,
  message: string,
  history: ChatTurn[],
): Promise<{ reply: string; expression: Expression }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY tidak tersedia');

  const model = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
  const base = {
    model,
    messages: [
      { role: 'system' as const, content: buildSystemPrompt(archetypeId) },
      ...history,
      { role: 'user' as const, content: message },
    ],
    // thinking dimatikan agar balasan cepat
    thinking: { type: 'disabled' as const },
    max_tokens: 512,
    temperature: 0.7,
  };

  async function post(body: object): Promise<{ text: string; finish: string }> {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`DeepSeek API ${response.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    };
    const choice = data.choices?.[0];
    return { text: choice?.message?.content ?? '', finish: choice?.finish_reason ?? 'unknown' };
  }

  // Utama: JSON mode. Sebagian balasan (mis. konten sensitif) bisa kosong —
  // retry sekali tanpa JSON mode sebelum menyerah.
  let { text, finish } = await post({ ...base, response_format: { type: 'json_object' } });
  if (!text.trim()) {
    console.warn(`[deepseek] balasan kosong (finish_reason=${finish}) — retry tanpa JSON mode`);
    ({ text, finish } = await post(base));
  }

  const parsed = parseModelJson(text);
  if (!parsed) throw new Error(`Balasan DeepSeek kosong (finish_reason=${finish})`);
  return parsed;
}

/* ---------- Claude mode (legacy, tetap didukung) ---------- */

/**
 * Panggil Anthropic API. Melempar error kalau gagal (route menangkap).
 */
export async function callClaude(
  archetypeId: ArchetypeId,
  message: string,
  history: ChatTurn[],
): Promise<{ reply: string; expression: Expression }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY tidak tersedia');

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      system: buildSystemPrompt(archetypeId),
      messages: [...history, { role: 'user', content: message }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Anthropic API ${response.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((block) => block.type === 'text')?.text ?? '';
  const parsed = parseModelJson(text);
  if (!parsed) throw new Error('Balasan model kosong/tidak terbaca');
  return parsed;
}
