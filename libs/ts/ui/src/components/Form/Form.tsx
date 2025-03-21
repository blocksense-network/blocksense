'use client';

import React, {
  useState,
  useContext,
  createContext,
  FormEvent,
  ChangeEvent,
  FormHTMLAttributes,
  ReactNode,
  ReactElement,
  MouseEvent,
} from 'react';

import { cn } from '@blocksense/ui/utils';
import { Button } from '@blocksense/ui/Button';
import { Input } from '@blocksense/ui/Input';
import { TextArea } from '@blocksense/ui/TextArea';
import { Label } from '@blocksense/ui/Label';

interface FormContextValue {
  values: Record<string, string | boolean | null>;
  setValue: (name: string, value: string | boolean | null) => void;
  resetForm: (e: MouseEvent<HTMLButtonElement>) => void;
  clearMessages: () => void;
}

const FormContext = createContext<FormContextValue>({} as FormContextValue);

interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  onReset?: () => void;
  errorMessage?: string;
  successMessage?: string;
  className?: string;
  children: ReactNode;
}

export const Form = ({
  children,
  onSubmit = () => {},
  onReset = () => {},
  className,
  errorMessage = 'Please fill out all required fields.',
  successMessage = 'Form submitted successfully!',
  ...props
}: FormProps): ReactElement => {
  const [values, setValues] = useState<Record<string, string | boolean | null>>(
    {},
  );
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const setValue = (name: string, value: string | boolean | null) => {
    setValues((prev: Record<string, string | boolean | null>) => ({
      ...prev,
      [name]: value,
    }));
  };

  const clearMessages = () => {
    if (showError) setShowError(false);
    if (showSuccess) setShowSuccess(false);
  };

  const resetForm = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setValues({});
    setShowSuccess(false);
    setShowError(false);
    if (onReset) onReset();
  };

  const submitFormAction = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearMessages();

    if (Object.values(values).length === 0) {
      setShowError(true);
      setShowSuccess(false);
      setTimeout(() => {
        setShowError(false);
      }, 3000);
      return;
    }

    onSubmit(e);
    setShowSuccess(true);
    setShowError(false);
    setTimeout(() => {
      setShowSuccess(false);
    }, 3000);
  };

  return (
    <FormContext.Provider
      value={{ values, setValue, resetForm, clearMessages }}
    >
      <form
        {...props}
        onSubmit={submitFormAction}
        className={cn(
          'form space-y-4 p-4 bg-white border border-gray-300 rounded-lg shadow-sm',
          className,
        )}
      >
        {showError && (
          <div className="bg-red-500 text-white text-sm p-4 rounded-md mb-4">
            {errorMessage}
          </div>
        )}
        {showSuccess && (
          <div className="bg-green-500 text-white text-sm p-4 rounded-md mb-4">
            {successMessage}
          </div>
        )}
        {children}
        <div className="flex justify-end space-x-2">
          <Button className="bg-blue-500 text-white px-4 py-2 rounded-md">
            Submit
          </Button>
          <Button onClick={resetForm} className="px-4 py-2 rounded-md">
            Reset
          </Button>
        </div>
      </form>
    </FormContext.Provider>
  );
};

interface FormFieldProps {
  name: string;
  label: string;
  placeholder?: string;
}

export const FormField = ({
  name,
  label,
  placeholder,
}: FormFieldProps): ReactElement => {
  const { values, setValue, clearMessages } = useContext(FormContext);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    clearMessages();
    setValue(name, e.target.value);
  };

  return (
    <fieldset className="form__field flex flex-col space-y-1">
      <legend className="sr-only">{label}</legend>
      <Label htmlFor={name} className="text-base font-medium">
        {label}
      </Label>
      <Input
        id={name}
        value={typeof values[name] === 'string' ? values[name] : ''}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={label}
      />
    </fieldset>
  );
};

export const FormTextArea = ({
  name,
  label,
  placeholder,
}: FormFieldProps): ReactElement => {
  const { values, setValue, clearMessages } = useContext(FormContext);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    clearMessages();
    setValue(name, e.target.value);
  };

  return (
    <fieldset className="form__textarea flex flex-col space-y-1">
      <TextArea
        id={name}
        value={typeof values[name] === 'string' ? values[name] : ''}
        onChange={handleChange}
        placeholder={placeholder}
        label={label}
        aria-label={label}
      />
    </fieldset>
  );
};

Form.displayName = 'Form';
FormTextArea.displayName = 'FormTextArea';
FormField.displayName = 'FormField';
