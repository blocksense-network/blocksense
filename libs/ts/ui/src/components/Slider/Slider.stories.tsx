'use client';

import React, { useState } from 'react';

import { Slider } from './Slider';

export default {
  title: 'Components/Slider',
  component: Slider,
};

export const BasicSlider = () => {
  const [value, setValue] = useState(50);

  return (
    <div className="p-4 w-full max-w-xl">
      <h2 className="font-medium text-lg">Basic Slider</h2>
      <Slider
        value={value}
        min={0}
        max={100}
        step={1}
        onChange={setValue}
        className="w-full"
      />
      <p>Value: {value}</p>
    </div>
  );
};

export const WideRangeSlider = () => {
  const [value, setValue] = useState(5000);

  return (
    <div className="p-4 w-full max-w-xl">
      <h2 className="font-medium text-lg">Wide Range Slider</h2>
      <Slider
        value={value}
        min={1000}
        max={50000}
        step={500}
        tickMode="line"
        onChange={setValue}
        className="w-full"
      />
      <p>Value: {value}</p>
    </div>
  );
};

export const PrecisionSlider = () => {
  const [value, setValue] = useState(5);

  return (
    <div className="p-4 w-full max-w-xl">
      <h2 className="font-medium text-lg">Precision Slider</h2>
      <Slider
        value={value}
        min={1}
        max={10}
        step={0.1}
        tickMode="dot"
        onChange={setValue}
        className="w-full"
      />
      <p>Value: {value}</p>
    </div>
  );
};

export const SteppedSlider = () => {
  const [value, setValue] = useState(25);

  return (
    <div className="p-4 w-full max-w-xl">
      <h2 className="font-medium text-lg">Stepped Slider</h2>
      <Slider
        value={value}
        min={0}
        max={100}
        step={25}
        tickMode="dot"
        onChange={setValue}
        className="w-full"
      />
      <p>Value: {value}</p>
    </div>
  );
};
