import React from 'react';

import { Separator } from './Separator';

export default {
  title: 'Components/Separator',
  component: Separator,
};

export const HorizontalSeparator = () => {
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        This is a horizontal separator.
      </p>
      <Separator className="my-1" />
    </div>
  );
};

export const SemanticVerticalSeparator = () => {
  return (
    <div className="flex h-5 items-center space-x-4 text-sm">
      <div>Blog</div>
      <Separator orientation="vertical" semanticRole />
      <div>Docs</div>
      <Separator orientation="vertical" semanticRole />
      <div>Source</div>
    </div>
  );
};

export const SeparatorOverview = () => {
  return (
    <div>
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">We are Blocksense</h4>
        <p className="text-sm text-muted-foreground">
          This is our open-source UI component library.
        </p>
      </div>
      <Separator className="my-4" />
      <div className="flex h-5 items-center space-x-4 text-sm">
        <div>Blog</div>
        <Separator orientation="vertical" semanticRole />
        <div>Docs</div>
        <Separator orientation="vertical" semanticRole />
        <div>Source</div>
      </div>
    </div>
  );
};
