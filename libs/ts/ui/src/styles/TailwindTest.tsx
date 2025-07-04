import React from 'react';

interface TailwindTestProps {
  text?: string;
}

export const TailwindTest: React.FC<TailwindTestProps> = ({
  text = 'Tailwind CSS Test',
}) => {
  return (
    <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-lg flex items-center space-x-4">
      <div className="shrink-0">
        <div className="h-12 w-12 bg-amber-400 rounded-full flex items-center justify-center">
          <span className="text-white font-bold">T</span>
        </div>
      </div>
      <div>
        <div className="text-xl font-medium text-black">{text}</div>
        <p className="text-slate-500">This should be styled with Tailwind!</p>
        <button className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 transition-colors">
          Click me
        </button>
      </div>
    </div>
  );
};
