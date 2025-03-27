'use client';

import React, { FieldsetHTMLAttributes, InputHTMLAttributes } from 'react';

import { cn } from '@blocksense/ui/utils';
import { Label } from '@blocksense/ui/Label';
import { Input } from '@blocksense/ui/Input';

type CheckboxProps = InputHTMLAttributes<HTMLInputElement>;

export const Checkbox = ({ children, className, ...props }: CheckboxProps) => {
  const inputElement = (
    <Input
      type="checkbox"
      className="checkbox__input h-4 cursor-pointer"
      {...props}
    />
  );

  if (children) {
    return (
      <section
        className={cn('checkbox__item flex items-center gap-2', className)}
      >
        {inputElement}
        <Label
          onClick={e => {
            e.stopPropagation();
          }}
          htmlFor={props.id}
          className="checkbox__label text-md cursor-pointer"
        >
          {children}
        </Label>
      </section>
    );
  }

  return inputElement;
};

type CheckboxGroupProps = FieldsetHTMLAttributes<HTMLFieldSetElement> & {
  label?: string;
  labelClassName?: string;
};

export const CheckboxGroup = ({
  children,
  className,
  label,
  labelClassName,
  ...props
}: CheckboxGroupProps) => {
  return (
    <fieldset
      className={cn('checkbox-group flex flex-col gap-1', className)}
      {...props}
    >
      {label && (
        <Label
          className={cn(
            'checkbox-group__label text-md font-bold',
            labelClassName,
          )}
        >
          {label}
        </Label>
      )}
      {children}
    </fieldset>
  );
};

Checkbox.displayName = 'Checkbox';
CheckboxGroup.displayName = 'CheckboxGroup';
