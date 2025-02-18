'use client';

export const R = () => {
  return (
    <div className="group">
      <p>r only</p>
      <p className="hidden group-hover:block group-focus:block">
        r with hidden
      </p>
      <p className="group-hover:block group-focus:block">r without hidden</p>
    </div>
  );
};
