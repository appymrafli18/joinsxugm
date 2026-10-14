import Svg, { Path, Circle, Rect } from 'react-native-svg';
import type { ReactNode } from 'react';
import { COLORS } from '@/constants/colors';

export function Icon({ children, size = 24, color = COLORS.text, strokeWidth = 1.8, fill = 'none' }: { children: ReactNode; size?: number; color?: string; strokeWidth?: number; fill?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">{children}</Svg>;
}
export const MailIcon = ({ color = COLORS.guardian }: { color?: string }) => <Icon color={color}><Rect x="3" y="5" width="18" height="14" rx="3" /><Path d="m4 7 8 6 8-6" /></Icon>;
export const LockIcon = ({ color = COLORS.guardian }: { color?: string }) => <Icon color={color}><Rect x="5" y="11" width="14" height="9" rx="3" /><Path d="M8 11V8a4 4 0 0 1 8 0v3" /></Icon>;
export const UserIcon = ({ color = COLORS.guardian }: { color?: string }) => <Icon color={color}><Circle cx="12" cy="8" r="4" /><Path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" /></Icon>;
export const EyeIcon = ({ color = COLORS.text }: { color?: string }) => <Icon color={color}><Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><Circle cx="12" cy="12" r="3" /></Icon>;
export const EyeOffIcon = ({ color = COLORS.text }: { color?: string }) => <Icon color={color}><Path d="M3 3l18 18" /><Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><Path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.3 6.8C3.6 8.6 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1" /></Icon>;
export const ChevronIcon = ({ color = COLORS.text, size = 20 }: { color?: string; size?: number }) => <Icon color={color} size={size} strokeWidth={2.2}><Path d="m9 6 6 6-6 6" /></Icon>;
export const ArrowIcon = () => <Icon color={COLORS.white} strokeWidth={2.5}><Path d="M5 12h14" /><Path d="m12 5 7 7-7 7" /></Icon>;
export const BellIcon = () => <Icon color={COLORS.guardian} size={21}><Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.73 21a2 2 0 0 1-3.46 0" /></Icon>;
export const ProfileIcon = ({ color = COLORS.text }: { color?: string }) => <Icon color={color}><Circle cx="12" cy="8" r="4" /><Path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" /></Icon>;
export const HeartHandIcon = ({ color = COLORS.guardian }: { color?: string }) => <Icon color={color}><Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></Icon>;
export const HomeIcon = ({ color = COLORS.text }: { color?: string }) => <Icon color={color} fill={color}><Path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5z" /></Icon>;
export const SparkleIcon = ({ size = 24, color = COLORS.sparkle }: { size?: number; color?: string }) => <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M12 0c.7 6.2 5.8 11.3 12 12-6.2.7-11.3 5.8-12 12-.7-6.2-5.8-11.3-12-12C6.2 11.3 11.3 6.2 12 0z" /></Svg>;
export const FireIcon = () => <Svg width="16" height="16" viewBox="0 0 16 16" fill={COLORS.cta}><Path d="M8 16c3.3 0 6-2.5 6-5.9 0-2.4-1.5-4.5-2.4-5.6-.3-.4-.9-.1-.8.3.2 1.1-.2 2.3-1.2 3.2-.2.2-.5.1-.6-.1-.5-1.2-.4-2.9.1-4.5C9.6 1.7 8.3.7 7.1.1c-.4-.2-.8.2-.7.6.4 1.3.2 2.7-.6 3.8C4.3 6.5 2 8.5 2 10.9 2 13.8 4.2 16 8 16z" /></Svg>;
export const StarIcon = ({ size = 16, color = '#DD6B55' }: { size?: number; color?: string }) => <Svg width={size} height={size} viewBox="0 0 16 16" fill={color}><Path d="M8 0l2 5.3H16l-4.4 3.4L13.2 14 8 10.8 2.8 14l1.6-5.3L0 5.3h6L8 0z" /></Svg>;
