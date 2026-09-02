import { useColorScheme } from 'react-native'

import { theme, type ThemeColors } from '@/constants/config'

export function useThemeColors(): { colors: ThemeColors; isDark: boolean } {
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'

  return { colors: isDark ? theme.dark : theme.light, isDark }
}
