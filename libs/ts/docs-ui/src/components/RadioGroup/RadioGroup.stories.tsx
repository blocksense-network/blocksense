import React, { useState } from 'react';

import { Button } from '@blocksense/docs-ui/Button';
import { RadioGroup, RadioGroupLabel, RadioGroupItem } from './RadioGroup';

export default {
  title: 'Components/RadioGroup',
  component: RadioGroup,
};

export const DefaultRadioGroup = () => {
  const [selectedOption, setSelectedOption] = useState('option1');

  return (
    <RadioGroup
      selectedValue={selectedOption}
      name="example"
      onValueChangeAction={setSelectedOption}
      aria-label="Choose an example option"
      className="p-4"
    >
      <RadioGroupItem value="option1">Option 1</RadioGroupItem>
      <RadioGroupItem value="option2">Option 2</RadioGroupItem>
      <RadioGroupItem value="option3">Option 3</RadioGroupItem>
    </RadioGroup>
  );
};

export const RadioGroupWithLabel = () => {
  const [selectedOption, setSelectedOption] = useState('option1');

  return (
    <RadioGroup
      selectedValue={selectedOption}
      name="example"
      onValueChangeAction={setSelectedOption}
      aria-label="Choose an example option"
      className="p-4"
    >
      <RadioGroupLabel>Choose your preferred example option:</RadioGroupLabel>
      <RadioGroupItem value="option1">Option 1</RadioGroupItem>
      <RadioGroupItem value="option2">Option 2</RadioGroupItem>
      <RadioGroupItem value="option3">Option 3</RadioGroupItem>
    </RadioGroup>
  );
};

export const RadioGroupWithButton = () => {
  const [selectedOption, setSelectedOption] = useState('option1');
  const [submittedValue, setSubmittedValue] = useState('');
  const nameOfRadioGroup = 'example';

  const handleSubmit = () => {
    setSubmittedValue(selectedOption);
  };

  return (
    <>
      <RadioGroup
        selectedValue={selectedOption}
        name={nameOfRadioGroup}
        onValueChangeAction={setSelectedOption}
        aria-label="Choose an example option"
      >
        <RadioGroupLabel>Choose your preferred example option:</RadioGroupLabel>
        <RadioGroupItem value="option1">Option 1</RadioGroupItem>
        <RadioGroupItem value="option2">Option 2</RadioGroupItem>
        <RadioGroupItem value="option3">Option 3</RadioGroupItem>
      </RadioGroup>
      <Button
        variant="highlight"
        className="mt-2 mb-2 font-bold w-full min-w-16 border-solid border border-slate-200 bg-slate-50 rounded-md dark:bg-neutral-900 dark:border-neutral-600 dark:text-white dark:hover:bg-black"
        onClick={handleSubmit}
      >
        Submit
      </Button>
      {submittedValue && (
        <pre className="textarea__submit-value text-sm text-green-500">
          {`You submitted the following values:
{
  ${nameOfRadioGroup}: ${submittedValue}
}`}
        </pre>
      )}
    </>
  );
};
