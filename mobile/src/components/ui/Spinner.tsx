import { ActivityIndicator } from 'react-native';
import { COLORS } from '@/constants/colors';

export function Spinner({ color = COLORS.guardian }: { color?: string }) {
  return <ActivityIndicator size="small" color={color} />;
}
