import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Side = 'left' | 'right' | 'top' | 'bottom';
export type Align = 'start' | 'center' | 'end';

export function getSideAlignClasses(side: Side, align: Align): string {
  let sideClass = '';
  let alignClass = '';
  let marginClass = '';

  switch (side) {
    case 'left':
      sideClass = 'right-full';
      marginClass = 'mr-2';
      break;
    case 'right':
      sideClass = 'left-full';
      marginClass = 'ml-2';
      break;
    case 'top':
      sideClass = 'bottom-full';
      marginClass = 'mb-2';
      break;
    case 'bottom':
      sideClass = 'top-full';
      marginClass = 'mt-2';
      break;
    default:
      sideClass = 'top-full';
      marginClass = 'mt-2';
  }

  if (side === 'left' || side === 'right') {
    switch (align) {
      case 'start':
        alignClass = 'top-0';
        break;
      case 'center':
        alignClass = 'top-1/2 -translate-y-1/2';
        break;
      case 'end':
        alignClass = 'bottom-0';
        break;
      default:
        alignClass = 'top-0';
    }
  } else {
    switch (align) {
      case 'start':
        alignClass = 'left-0';
        break;
      case 'center':
        alignClass = 'left-1/2 -translate-x-1/2';
        break;
      case 'end':
        alignClass = 'right-0';
        break;
      default:
        alignClass = 'left-0';
    }
  }

  return `${sideClass} ${alignClass} ${marginClass}`;
}
