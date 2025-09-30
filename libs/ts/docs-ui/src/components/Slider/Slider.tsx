'use client';

import React, { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';

type SliderProps = {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  tickMode?: 'line' | 'dot';
  className?: string;
  onChange?: (value: number) => void;
};

export const Slider = ({
  className = '',
  max = 100,
  min = 0,
  onChange,
  step = 1,
  tickMode,
  value = 0,
}: SliderProps) => {
  const [sliderValue, setSliderValue] = useState(value);

  useEffect(() => {
    setSliderValue(value);
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(event.target.value);
    setSliderValue(newValue);
    onChange?.(newValue);
  };

  return (
    <div className={`slider w-full flex flex-col items-center ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        onChange={handleChange}
        className="slider__input w-full cursor-pointer bg-blue-600"
        aria-label="Slider"
      />
      {tickMode && (
        <div className="slider__ticks relative w-full flex justify-between mt-2">
          {Array.from(
            { length: (max - min) / step + 1 },
            (_, i) => min + i * step,
          ).map(tick => (
            <div
              key={tick}
              className={`slider__tick absolute ${
                tickMode === 'line'
                  ? 'w-px h-3 bg-gray-300'
                  : 'w-2 h-2 rounded-full bg-gray-300'
              }`}
              style={{
                left: `calc(${((tick - min) / (max - min)) * 100}% - 0.5px)`,
              }}
            />
          ))}
        </div>
      )}
      <div className="slider__labels flex justify-between w-full text-xs text-gray-500 mt-4">
        <span className="slider__label slider__label--min">{min}</span>
        <span className="slider__label slider__label--value">
          {sliderValue}
        </span>
        <span className="slider__label slider__label--max">{max}</span>
      </div>
    </div>
  );
};

Slider.displayName = 'Slider';
