import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'

import { useThemeColors } from '@/hooks/useThemeColors'

type Props = Readonly<{
  label: string
  onPress: () => void
  busy?: boolean
  variant?: 'primary' | 'ghost'
}>

export function LeafButton({ label, onPress, busy = false, variant = 'primary' }: Props) {
  const { colors } = useThemeColors()
  const primary = variant === 'primary'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary
          ? { backgroundColor: pressed ? colors.brandStrong : colors.brand }
          : { backgroundColor: pressed ? colors.skeleton : 'transparent' },
        busy && styles.busy,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? '#ffffff' : colors.brand} />
      ) : (
        <Text style={[styles.label, { color: primary ? '#ffffff' : colors.brand }]}>{label}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  busy: {
    opacity: 0.8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
})
