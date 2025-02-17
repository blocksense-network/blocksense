import React from 'react';

type IllustrationBoxProps = {
  title: string;
  description: string;
};

const IllustrationBox = ({ title, description }) => {
  return (
    <div className="border p-4 rounded-lg shadow-md bg-gray-100 w-80">
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      <p className="text-gray-700">{description}</p>
    </div>
  );
};

export default IllustrationBox;
