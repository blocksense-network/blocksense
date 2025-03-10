import React, { useState, useEffect } from 'react';
import { Button } from '@blocksense/ui/Button';
import { ProgressBar } from './ProgressBar';

export default {
  title: 'Components/ProgressBar',
  component: ProgressBar,
};

export const Default = () => {
  const [progress, setProgress] = useState(30);

  return (
    <div className="flex flex-col items-center gap-4">
      <ProgressBar value={progress} />
      <div className="flex gap-2">
        <Button onClick={() => setProgress(prev => Math.max(0, prev - 10))}>
          -10%
        </Button>
        <Button onClick={() => setProgress(prev => Math.min(100, prev + 10))}>
          +10%
        </Button>
      </div>
    </div>
  );
};

export const Spinner = () => <ProgressBar isIndeterminate />;

export const FullscreenLoading = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
    <ProgressBar isIndeterminate size={80} />
  </div>
);
