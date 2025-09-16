import * as React from 'react';
import { ReactNode } from 'react';
import { Tailwind } from '@react-email/tailwind';
import { render } from '@react-email/render';

export function renderEmail(component: ReactNode) {
  return render(<Tailwind>{component}</Tailwind>);
}
