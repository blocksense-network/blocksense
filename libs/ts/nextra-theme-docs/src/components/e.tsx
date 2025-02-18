'use client';

export const E = () => {
  return (
    <div className="group">
      <p>e only</p>
      <p className="hidden group-hover:block group-focus:block">
        e with hidden
      </p>
      <p className="group-hover:block group-focus:block">e without hidden</p>
    </div>
  );
};
