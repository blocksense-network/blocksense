'use client';

import React, {
  createContext,
  useContext,
  ReactNode,
  HTMLAttributes,
  FieldsetHTMLAttributes,
} from 'react';

import { cn } from '@blocksense/ui/utils';
import { Label } from '@blocksense/ui/Label';
import { Input } from '@blocksense/ui/Input';

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
  children: ReactNode;
};

export const RadioGroup = ({
  selectedValue,
  name,
  onValueChangeAction,
  children,
  className,
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

type RadioGroupLabelProps = HTMLAttributes<HTMLLabelElement> & {
  children: ReactNode;
};

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
  children: ReactNode;
};

export const RadioGroupItem = ({
  value,
  children,
  className,
  ...props
}: RadioGroupItemProps) => {
  const { selectedValue, name, onValueChangeAction } =
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
