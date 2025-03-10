import React from 'react';

import { ScrollArea } from './ScrollArea';

export default {
  title: 'Components/ScrollArea',
  component: ScrollArea,
};

export const Default = () => {
  return (
    <div className="p-4">
      <ScrollArea className="w-64 h-64 border border-neutral-200 p-4">
        <div className="h-[300px] bg-gray-200/75 p-2">
          Scroll down to view more content.
        </div>
        <div className="h-[500px] bg-gray-300/70 p-2 mt-4">
          More content ahead! Keep scrolling to see what's next.
        </div>
        <div className="h-[300px] bg-gray-400/50 p-2 mt-4">
          You've reached the end of the content.
        </div>
      </ScrollArea>
    </div>
  );
};

export const LongTextContent = () => {
  return (
    <div className="p-4">
      <ScrollArea className="w-80 h-40 border border-neutral-200 p-4">
        <p className="whitespace-pre-line">
          This scroll area helps users navigate through long text smoothly,
          keeping content accessible and organized. It provides a seamless
          scrolling experience, ensuring that large amounts of information
          remain viewable without overwhelming the layout. Whether users read
          articles, review documentation, or view chat messages, this component
          enhances usability by maintaining clarity and structure while allowing
          users to focus on the most important content.
        </p>
      </ScrollArea>
    </div>
  );
};

export const NestedScrollAreas = () => {
  return (
    <div className="p-4">
      <ScrollArea className="w-80 h-80 border border-neutral-200 p-4">
        <div className="h-[400px] bg-gray-100 p-2">
          Outer ScrollArea
          <ScrollArea className="w-64 h-40 mt-4 border border-neutral-200 bg-white p-2">
            <div className="h-[200px] bg-gray-300/70 p-2">Inner ScrollArea</div>
          </ScrollArea>
        </div>
      </ScrollArea>
    </div>
  );
};

export const ScrollingList = () => {
  return (
    <div className="p-4">
      <ScrollArea className="w-72 h-60 border border-neutral-200 p-4">
        <ul className="space-y-2">
          {Array.from({ length: 42 }, (_, i) => (
            <li key={i} className="p-2 bg-gray-100 border-b border-neutral-200">
              Item {i + 1}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
};
