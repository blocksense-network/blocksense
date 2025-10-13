import React, { useEffect, useState } from 'react';

import { Button } from '@blocksense/docs-ui/Button';

import { ProgressBar } from './ProgressBar';

export default {
  title: 'Components/ProgressBar',
  component: ProgressBar,
};

export const Default = () => {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setLoading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [loading]);

  return (
    <div className="flex flex-col items-center gap-4">
      <ProgressBar value={progress} />
      {loading && <p>Loading... {progress}%</p>}
      {!loading && <p>Completed! Progress: 100%</p>}
    </div>
  );
};

export const Spinner = () => <ProgressBar isIndeterminate />;

export const FullscreenLoading = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
    <ProgressBar isIndeterminate size={80} />
  </div>
);

export const ProgressWithButtons = () => {
  const [progress, setProgress] = useState(0);

  return (
    <div className="flex flex-col items-center gap-4">
      <ProgressBar value={progress} />
      <div className="flex gap-2">
        <Button onClick={() => setProgress(prev => Math.max(0, prev - 5))}>
          -5%
        </Button>
        <Button onClick={() => setProgress(prev => Math.min(100, prev + 5))}>
          +5%
        </Button>
      </div>
    </div>
  );
};
