import { useEffect, useRef } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native'

import { useThemeColors } from '@/hooks/useThemeColors'

export function PageSkeleton() {
  const { colors } = useThemeColors()
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null
    let cancelled = false

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled || reduceMotion) return

      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 0.45,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      )
      animation.start()
    })

    return () => {
      cancelled = true
      animation?.stop()
    }
  }, [pulse])

  const block = { backgroundColor: colors.skeleton }

  return (
    <View
      accessibilityLabel="Carregando"
      accessibilityRole="progressbar"
      style={[styles.container, { backgroundColor: colors.ground }]}
    >
      <Animated.View style={{ opacity: pulse }}>
        <View style={[styles.topbar, block]} />
        <View style={[styles.title, block]} />
        <View style={[styles.line, block]} />
        <View style={[styles.line, styles.lineShort, block]} />
        <View style={[styles.line, block]} />
        <View style={[styles.line, styles.lineShorter, block]} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  topbar: {
    width: '40%',
    height: 20,
    borderRadius: 6,
    marginBottom: 40,
  },
  title: {
    width: '70%',
    height: 34,
    borderRadius: 8,
    marginBottom: 28,
  },
  line: {
    width: '100%',
    height: 16,
    borderRadius: 4,
    marginBottom: 14,
  },
  lineShort: {
    width: '85%',
  },
  lineShorter: {
    width: '55%',
  },
})
