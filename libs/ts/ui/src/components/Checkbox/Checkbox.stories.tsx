import React, { useState, ChangeEvent } from 'react';

import { Button } from '@blocksense/ui/Button';
import { Checkbox, CheckboxGroup } from './Checkbox';

export default {
  title: 'Components/Checkbox',
  component: Checkbox,
};

export const StandaloneCheckbox = () => {
  return <Checkbox id="option1" value="option1" name="exampleOptions" />;
};

export const CheckboxWithLabel = () => {
  return (
    <Checkbox id="option1" value="option1" name="exampleOptions">
      Option 1
    </Checkbox>
  );
};

export const ControlledCheckbox = () => {
  const [isChecked, setIsChecked] = useState(true);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setIsChecked(event.target.checked);
  };

  return (
    <Checkbox
      id="option1"
      value="option1"
      name="exampleOptions"
      checked={isChecked}
      onChange={handleChange}
    >
      Option 1
    </Checkbox>
  );
};

export const CheckboxGroupWithNoLabel = () => {
  return (
    <CheckboxGroup>
      <Checkbox id="option1" value="option1" name="exampleOptions">
        Option 1
      </Checkbox>
      <Checkbox id="option2" value="option2" name="exampleOptions">
        Option 2
      </Checkbox>
    </CheckboxGroup>
  );
};

export const CheckboxGroupWithLabel = () => {
  return (
    <CheckboxGroup label="Select your options:">
      <Checkbox id={'option1'} value={'option1'} name={'exampleOptions'}>
        Option 1
      </Checkbox>
      <Checkbox id={'option2'} value={'option2'} name={'exampleOptions'}>
        Option 2
      </Checkbox>
    </CheckboxGroup>
  );
};

const checkboxes = ['option1', 'option2', 'option3'];

export const ControlledCheckboxGroup = () => {
  const [selectedValues, setSelectedValues] = useState<string[]>(['option1']);

  const handleCheckboxChange = (id: string) => {
    setSelectedValues(prevSelectedValues =>
      prevSelectedValues.includes(id)
        ? prevSelectedValues.filter(value => value !== id)
        : [...prevSelectedValues, id],
    );
  };

  return (
    <CheckboxGroup name="exampleOptions">
      {checkboxes.map(checkbox => {
        const isChecked = selectedValues.includes(checkbox);

        return (
          <Checkbox
            key={checkbox}
            id={checkbox}
            value={checkbox}
            checked={isChecked}
            onChange={() => handleCheckboxChange(checkbox)}
          >
            {checkbox.replace('option', 'Option ')}
          </Checkbox>
        );
      })}
    </CheckboxGroup>
  );
};

export const CheckboxGroupWithButton = () => {
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [submittedValues, setSubmittedValues] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const nameOfCheckboxGroup = 'exampleOptions';

  const handleCheckboxChange = (value: string) => {
    setSelectedValues(prevSelectedValues =>
      prevSelectedValues.includes(value)
        ? prevSelectedValues.filter(v => v !== value)
        : [...prevSelectedValues, value],
    );
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    setSubmittedValues(selectedValues);
  };

  const renderMessage = () => {
    if (submittedValues.length > 0) {
      return (
        <pre className="textarea__submit-value text-sm text-green-500">
          {`You submitted the following values:
{
  ${nameOfCheckboxGroup}: [${submittedValues.join(', ')}]
}`}
        </pre>
      );
    }

    if (isSubmitted) {
      return (
        <p className="text-sm text-red-500">You have to select an option!</p>
      );
    }

    return null;
  };

  return (
    <>
      <CheckboxGroup label="Select your options:" name={nameOfCheckboxGroup}>
        {checkboxes.map(checkbox => (
          <Checkbox
            key={checkbox}
            id={checkbox}
            value={checkbox}
            checked={selectedValues.includes(checkbox)}
            onChange={() => handleCheckboxChange(checkbox)}
          >
            {checkbox.replace('option', 'Option ')}
          </Checkbox>
        ))}
      </CheckboxGroup>
      <Button
        variant="highlight"
        className="mt-2 mb-2 font-bold w-full min-w-16 border-solid border border-slate-200 bg-slate-50 rounded-md dark:bg-neutral-900 dark:border-neutral-600 dark:text-white dark:hover:bg-black"
        onClick={handleSubmit}
      >
        Submit
      </Button>
      {renderMessage()}
    </>
  );
};
