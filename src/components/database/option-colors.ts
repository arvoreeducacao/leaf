import type { OptionColor } from '@/lib/database/values'

export const optionChipClass: Record<OptionColor, string> = {
  gray: 'border-gray-300 bg-gray-200 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
  primary:
    'border-primary-200 bg-primary-100 text-primary-900 dark:border-primary-900 dark:bg-primary-950 dark:text-primary-200',
  blue: 'border-blue-200 bg-blue-100 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200',
  lime: 'border-lime-200 bg-lime-100 text-lime-900 dark:border-lime-900 dark:bg-lime-950 dark:text-lime-200',
  orange:
    'border-orange-200 bg-orange-100 text-orange-900 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200',
  purple:
    'border-purple-200 bg-purple-100 text-purple-900 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-200',
  warning:
    'border-warning-200 bg-warning-100 text-warning-900 dark:border-warning-900 dark:bg-warning-950 dark:text-warning-200',
  error:
    'border-error-200 bg-error-100 text-error-900 dark:border-error-900 dark:bg-error-950 dark:text-error-200',
  success:
    'border-success-200 bg-success-100 text-success-900 dark:border-success-900 dark:bg-success-950 dark:text-success-200',
}

export const optionDotClass: Record<OptionColor, string> = {
  gray: 'bg-gray-500',
  primary: 'bg-primary-600',
  blue: 'bg-blue-600',
  lime: 'bg-lime-600',
  orange: 'bg-orange-600',
  purple: 'bg-purple-600',
  warning: 'bg-warning-600',
  error: 'bg-error-600',
  success: 'bg-success-600',
}
