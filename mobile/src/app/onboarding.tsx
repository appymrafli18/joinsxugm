import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { SparkleIcon } from '@/components/common/Icon';
import { COLORS } from '@/constants/colors';
import { FONT, RADIUS, SHADOW } from '@/constants/theme';
import {
  ANSWER_OPTIONS,
  ONBOARDING_QUESTIONS,
  SCREENING_TIMEFRAME_LABEL,
  type OnboardingQuestion,
} from '@/lib/questions';
import { SCREENING_STORAGE_KEY } from '@/lib/profile';
import { writeJson } from '@/lib/storage';
import { mix } from '@/utils/color';

const ANSWER_DELAY_MS = 400;
/** Durasi fade keluar (web: transition opacity 220ms ease-in-out). */
const EXIT_DURATION_MS = 220;
/** Durasi fade masuk (web: onboarding-step-enter 260ms ease-out). */
const ENTER_DURATION_MS = 260;
const CURVE_RATIO = 0.11; // dari web: borderBottomRadius "50% 11%" — RN hanya bisa radius bulat, pakai sisi vertikal (11% tinggi)
const BLEED_SCALE = 1.06; // dari web: origin-top scale-[1.06]

const images = {
  guardian: require('@/assets/images/raster/guardian_onboarding.png'),
  healer: require('@/assets/images/raster/healer_onboarding.png'),
  scholar: require('@/assets/images/raster/scholar_onboarding.png'),
} as const;

type OnboardingTheme = {
  imageAlt: string;
  showCardSparkle: boolean;
  pageBg: string;
  card: string;
  tone: string;
  dot: string;
  cta: string;
  text: string;
};

/*
 * Nilai diambil 1:1 dari web/components/onboarding/OnboardingScreen.tsx
 * (termasuk nilai ESTIMASI yang sudah dipakai di web).
 */
const THEMES: Record<
  Exclude<OnboardingQuestion['archetype'], 'companion'>,
  OnboardingTheme
> = {
  guardian: {
    imageAlt: 'Ilustrasi The Guardian',
    showCardSparkle: true,
    pageBg: '#FBF8FD', // token base
    card: '#EDE7F5', // token guardian.card
    tone: '#9B82C4', // token guardian
    dot: '#9B82C4', // token guardian
    cta: '#E3779B', // token cta
    text: '#4A2C73', // ESTIMASI web
  },
  healer: {
    imageAlt: 'Ilustrasi The Healer',
    showCardSparkle: false,
    pageBg: '#FFF6F8', // ESTIMASI web
    card: '#FBEEF1', // token healer.card
    tone: '#E3A8B5', // token healer
    dot: '#EA5C8A', // ESTIMASI web
    cta: '#EA5C8A', // ESTIMASI web
    text: '#5A2B42', // ESTIMASI web
  },
  scholar: {
    imageAlt: 'Ilustrasi The Scholar',
    showCardSparkle: false,
    pageBg: '#F6F7FC', // ESTIMASI web
    card: '#EAECF8', // token scholar.card
    tone: '#7B88C4', // token scholar
    dot: '#5B4B8F', // ESTIMASI web
    cta: '#5B4B8F', // ESTIMASI web
    text: '#2F2B5C', // ESTIMASI web
  },
};

function getTheme(
  archetype: OnboardingQuestion['archetype'],
): OnboardingTheme {
  return archetype === 'companion' ? THEMES.guardian : THEMES[archetype];
}

const ABSOLUTE_FILL = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [step, setStep] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const answersRef = useRef<number[]>([]);
  // Animated.Value dibuat sekali via lazy useState (state initializer tidak
  // membuat animasi baru di tiap render).
  const [fadeAnim] = useState(() => new Animated.Value(1));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  const question = ONBOARDING_QUESTIONS[step];
  const theme = getTheme(question.archetype);

  // web: h-[min(57.7dvh,124.9vw)] — hindari persentase height bersarang di RN.
  const artHeight = Math.round(Math.min(height * 0.577, width * 1.249));
  // web: borderBottomRadius "50% 11%" — RN tidak mendukung radius elips,
  // pakai sisi vertikal (11% tinggi) sebagai kedalaman kurva.
  const curveRadius = Math.round(artHeight * CURVE_RATIO);
  // web: text-[clamp(16px,5vw,20px)]
  const questionFontSize = Math.min(20, Math.max(16, width * 0.05));
  // web: pb-[max(2.75rem,calc(env(safe-area-inset-bottom)+1.5rem))]
  const contentBottomPadding = Math.max(44, insets.bottom + 24);

  // web: buttonBg = mix(theme.card, 85, theme.tone)
  const buttonBg = mix(theme.card, 85, theme.tone);
  // web: chipText = mix(theme.text, 75, theme.pageBg)
  const chipTextColor = mix(theme.text, 75, theme.pageBg);

  function animateFade(
    toValue: number,
    duration: number,
    easing: (t: number) => number,
  ) {
    if (reduceMotion) {
      fadeAnim.setValue(toValue);
      return;
    }
    Animated.timing(fadeAnim, {
      toValue,
      duration,
      easing,
      useNativeDriver: true,
    }).start();
  }

  function selectAnswer(value: number) {
    if (isTransitioning) return;

    setSelectedAnswer(value);
    answersRef.current = [...answersRef.current, value];
    setIsTransitioning(true);
    // web: konten fade-out 220ms ease-in-out sebelum langkah berganti.
    animateFade(0, EXIT_DURATION_MS, Easing.inOut(Easing.ease));

    timeoutRef.current = setTimeout(
      () => {
        if (step === ONBOARDING_QUESTIONS.length - 1) {
          void writeJson(SCREENING_STORAGE_KEY, answersRef.current);
          // TODO(BE): setelah register berhasil, kirim jawaban ini ke API lalu hapus dari storage.
          router.replace('/login');
          return;
        }

        setStep((currentStep) => currentStep + 1);
        setSelectedAnswer(null);
        setIsTransitioning(false);
        // web: langkah baru fade-in 260ms ease-out.
        fadeAnim.setValue(reduceMotion ? 1 : 0);
        animateFade(1, ENTER_DURATION_MS, Easing.out(Easing.ease));
      },
      reduceMotion ? 0 : ANSWER_DELAY_MS,
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.pageBg }]}>
      {/* Wave dekoratif di dasar layar (web: SVG path asli, fill warna card, opacity 0.8) */}
      <View style={styles.wave} pointerEvents="none" accessibilityElementsHidden>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 390 64"
          preserveAspectRatio="none"
        >
          <Path
            d="M0 30C70 10 140 8 215 22S345 42 390 22V64H0Z"
            fill={theme.card}
            opacity={0.8}
          />
        </Svg>
      </View>

      {/* Bagian ilustrasi + kurva bawah */}
      <Animated.View
        style={[
          styles.artSection,
          {
            height: artHeight,
            backgroundColor: theme.card,
            borderBottomLeftRadius: curveRadius,
            borderBottomRightRadius: curveRadius,
            opacity: fadeAnim,
          },
        ]}
      >
        <Image
          source={images[(question.archetype === 'companion' ? 'guardian' : question.archetype) as keyof typeof images]}
          alt={theme.imageAlt}
          contentFit="cover"
          contentPosition="top"
          style={[
            ABSOLUTE_FILL,
            // web: origin-top scale-[1.06] — scale dari tengah, kompensasi
            // translate agar sisi atas tetap di tempat seperti transform-origin top.
            {
              transform: [
                { scale: BLEED_SCALE },
                { translateY: artHeight * ((BLEED_SCALE - 1) / 2) },
              ],
            },
          ]}
        />
      </Animated.View>

      {/* Konten pertanyaan */}
      <Animated.View
        style={[
          styles.content,
          { paddingBottom: contentBottomPadding, opacity: fadeAnim },
        ]}
      >
        <View
          style={styles.progress}
          accessibilityLabel={`Progres pertanyaan ${step + 1} dari ${ONBOARDING_QUESTIONS.length}`}
        >
          {ONBOARDING_QUESTIONS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index <= step ? theme.dot : 'rgba(59,46,74,0.15)',
                },
              ]}
            />
          ))}
        </View>

        <Text
          style={[
            styles.chip,
            { backgroundColor: theme.card, color: chipTextColor },
          ]}
        >
          Pertanyaan {step + 1} dari {ONBOARDING_QUESTIONS.length}
        </Text>

        <Text style={styles.timeframe}>{SCREENING_TIMEFRAME_LABEL}</Text>

        <View style={styles.questionArea}>
          <View style={styles.questionWrap}>
            {theme.showCardSparkle && (
              <View style={styles.questionSparkle}>
                <SparkleIcon size={24} />
              </View>
            )}
            <Text
              accessibilityRole="header"
              style={[
                styles.question,
                {
                  backgroundColor: theme.card,
                  color: theme.text,
                  fontSize: questionFontSize,
                  lineHeight: Math.round(questionFontSize * 1.5),
                },
              ]}
            >
              {question.text}
            </Text>
          </View>
        </View>

        <View style={styles.answers} accessibilityRole="radiogroup">
          {ANSWER_OPTIONS.map((option) => {
            const isSelected = selectedAnswer === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => selectAnswer(option.value)}
                disabled={isTransitioning}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: isSelected,
                  disabled: isTransitioning,
                }}
                style={[
                  styles.answer,
                  { backgroundColor: isSelected ? theme.cta : buttonBg },
                ]}
              >
                <Text
                  style={[
                    styles.answerText,
                    { color: isSelected ? COLORS.white : theme.text },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  wave: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, zIndex: 0 },
  artSection: { width: '100%', flexShrink: 0, overflow: 'hidden' },
  content: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    paddingHorizontal: 22,
    zIndex: 1,
  },
  progress: { flexDirection: 'row', gap: 8, marginTop: 20 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chip: {
    marginTop: 20,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontFamily: FONT,
    fontSize: 12,
  },
  timeframe: {
    marginTop: 10,
    fontFamily: FONT,
    fontSize: 11,
    lineHeight: 17,
    color: 'rgba(59,46,74,0.6)',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  questionArea: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    justifyContent: 'center',
    marginTop: 16,
  },
  questionWrap: { width: '100%' },
  questionSparkle: { position: 'absolute', left: -4, top: -12, zIndex: 10 },
  question: {
    width: '100%',
    minHeight: 112,
    borderRadius: RADIUS.card,
    paddingHorizontal: 20,
    paddingVertical: 24,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontFamily: FONT,
    ...SHADOW.float,
  },
  answers: { width: '100%', flexDirection: 'row', gap: 12, marginTop: 16 },
  answer: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.float,
  },
  answerText: { fontFamily: FONT, fontSize: 12 },
});
