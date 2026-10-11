export type ArchetypeKey = "guardian" | "healer" | "scholar" | "companion";

export type OnboardingQuestion = {
  text: string;
  archetype: ArchetypeKey;
  characterName: string;
};

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    text: "Aku lebih nyaman menulis perasaanku daripada mengucapkannya.",
    archetype: "guardian",
    characterName: "The Guardian",
  },
  {
    text: "Bertemu orang baru secara langsung terasa melelahkan buatku.",
    archetype: "healer",
    characterName: "The Healer",
  },
  {
    text: "Aku sering menunda keluar rumah meski tidak ada halangan nyata.",
    archetype: "scholar",
    characterName: "The Scholar",
  },
];

export const ANSWER_OPTIONS = [
  { label: "Tidak Setuju", value: 0 },
  { label: "Netral", value: 1 },
  { label: "Setuju", value: 2 },
];