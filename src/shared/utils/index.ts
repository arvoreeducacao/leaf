import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const fontSizes = [
  'caption',
  'body-small',
  'body-medium',
  'heading-medium',
  'heading-large',
  'display-small',
  'display-medium',
  'display-large',
]

const fontWeights = ['regular', 'medium', 'semibold', 'bold', 'heavy']

const radii = ['small', 'medium', 'large', 'xlarge', 'pill', 'circular']

const elevations = [
  'down-small',
  'down-medium',
  'down-large',
  'down-xlarge',
  'center-small',
  'center-medium',
  'center-large',
  'center-xlarge',
  'up-small',
  'up-medium',
  'up-large',
  'up-xlarge',
]

const leadings = ['small', 'medium', 'large']

const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: fontSizes }],
      'font-weight': [{ font: fontWeights }],
      rounded: [{ rounded: radii }],
      shadow: [{ shadow: elevations }],
      leading: [{ leading: leadings }],
    },
  },
})

export function cn(...inputs: Array<ClassValue>) {
  return merge(clsx(inputs))
}
