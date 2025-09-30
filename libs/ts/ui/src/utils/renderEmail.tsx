import * as React from 'react';
import { render } from '@react-email/render';
import { Tailwind } from '@react-email/tailwind';
import type { ReactNode } from 'react';

export function renderEmail(component: ReactNode) {
  return render(<Tailwind>{component}</Tailwind>);
}
