'use client';

import React, { createContext, useContext } from 'react';
import type { FieldsetHTMLAttributes, HTMLAttributes } from 'react';

import { Input } from '@blocksense/docs-ui/Input';
import { Label } from '@blocksense/docs-ui/Label';
import { cn } from '@blocksense/docs-ui/utils';

type RadioGroupContextValue = {
  selectedValue: string;
  name: string;
  onValueChangeAction: (value: string) => void;
};

const RadioGroupContext = createContext<RadioGroupContextValue>(
  {} as RadioGroupContextValue,
);

type RadioGroupProps = FieldsetHTMLAttributes<HTMLFieldSetElement> & {
  selectedValue: string;
  name: string;
  onValueChangeAction: (value: string) => void;
};

export const RadioGroup = ({
  children,
  className,
  name,
  onValueChangeAction,
  selectedValue,
  ...props
}: RadioGroupProps) => {
  return (
    <RadioGroupContext.Provider
      value={{ selectedValue, name, onValueChangeAction }}
    >
      <fieldset
        className={cn('radio-group flex flex-col gap-1', className)}
        {...props}
      >
        {children}
      </fieldset>
    </RadioGroupContext.Provider>
  );
};

type RadioGroupLabelProps = HTMLAttributes<HTMLLabelElement>;

export const RadioGroupLabel = ({
  children,
  className,
  ...props
}: RadioGroupLabelProps) => {
  return (
    <Label
      className={cn('radio-group__label text-md font-bold', className)}
      {...props}
    >
      {children}
    </Label>
  );
};

type RadioGroupItemProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
};

export const RadioGroupItem = ({
  children,
  className,
  value,
  ...props
}: RadioGroupItemProps) => {
  const { name, onValueChangeAction, selectedValue } =
    useContext(RadioGroupContext);

  const isSelected = selectedValue === value;

  return (
    <div
      onClick={() => onValueChangeAction(value)}
      className={cn(
        'radio-group__item flex items-center gap-2 cursor-pointer',
        className,
      )}
      {...props}
    >
      <Input
        type="radio"
        id={value}
        name={name}
        value={value}
        checked={isSelected}
        onChange={() => onValueChangeAction(value)}
        className="radio-group__input h-4"
      />
      <Label htmlFor={value} className="radio-group__label text-md">
        {children}
      </Label>
    </div>
  );
};

RadioGroup.displayName = 'RadioGroup';
RadioGroupLabel.displayName = 'RadioGroupLabel';
RadioGroupItem.displayName = 'RadioGroupItem';
