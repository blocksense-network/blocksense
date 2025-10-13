import React, { useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';

import { Button } from '@blocksense/docs-ui/Button';

import { TextArea } from './TextArea';

export default {
  title: 'Components/TextArea',
  component: TextArea,
};

export const DefaultTextArea = () => (
  <TextArea
    className="resize min-w-80 min-h-30"
    name="message"
    placeholder="Type your message here."
    variant="outline"
  />
);

export const TextAreaWithLabel = () => (
  <TextArea
    className="resize min-w-80 min-h-30"
    labelSize="text-sm"
    label="Comments"
    name="comments"
    placeholder="Write your comments here."
    variant="outline"
  />
);

export const TextAreaWithError = () => {
  const [error, setError] = useState(true);
  const [value, setValue] = useState('');

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const inputValue = event.target.value;
    setValue(inputValue);

    if (inputValue.trim() !== '') {
      setError(false);
    } else {
      setError(true);
    }
  };
  return (
    <TextArea
      className="resize min-w-80 min-h-30"
      name="notes"
      placeholder="Add your notes here."
      variant="outline"
      error={error}
      errorMessage="This field is required."
      value={value}
      onChange={handleChange}
    />
  );
};

export const DisabledTextArea = () => (
  <TextArea
    className="resize min-w-80 min-h-30"
    name="comments"
    placeholder="It is not allowed to add comments here!"
    variant="outline"
    disabled
  />
);

export const TextAreaWithButton = () => {
  const [value, setValue] = useState('');

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
  };

  const clearContent = () => {
    setValue('');
  };

  return (
    <>
      <TextArea
        className="resize min-w-[300px] min-h-[100px]"
        name="comments"
        placeholder="Write your comments here."
        variant="outline"
        value={value}
        onChange={handleChange}
      />
      <Button
        variant="highlight"
        className="mt-2 mb-2 font-bold w-full min-w-16 border-solid border border-slate-200 bg-slate-50 rounded-md dark:bg-neutral-900 dark:border-neutral-600 dark:text-white dark:hover:bg-black"
        onClick={clearContent}
      >
        Clear
      </Button>
    </>
  );
};

export const TextAreaWithForm = () => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const inputValue = event.target.value.trim();
    setValue(inputValue);
    setIsSubmitted(false);
  };

  const handleSubmit = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (value) {
      setIsSubmitted(true);
    } else {
      setError(true);
    }
  };

  const clearContent = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setValue('');
    setError(false);
    setIsSubmitted(false);
  };

  return (
    <form className="space-y-4">
      <TextArea
        className="resize min-w-[300px] min-h-[100px]"
        name="notes"
        label="Notes"
        placeholder="Write your notes here."
        variant="outline"
        value={value}
        onChange={handleChange}
        error={error}
        errorMessage="This field is required."
      />
      <div className="flex gap-4">
        <Button
          variant="highlight"
          className="font-bold w-full border border-slate-200 bg-slate-50 rounded-md dark:bg-neutral-900 dark:border-neutral-600 dark:text-white dark:hover:bg-black"
          onClick={handleSubmit}
        >
          Submit
        </Button>
        <Button
          variant="highlight"
          className="font-bold w-full border border-slate-200 bg-slate-50 rounded-md dark:bg-neutral-900 dark:border-neutral-600 dark:text-white dark:hover:bg-black"
          onClick={clearContent}
        >
          Clear
        </Button>
      </div>
      {isSubmitted && value && (
        <p className="textarea__submit-value text-sm text-green-500">
          {`Form submitted with value: ${value}`}
        </p>
      )}
    </form>
  );
};
