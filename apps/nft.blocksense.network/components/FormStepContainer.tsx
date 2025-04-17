import { ReactNode } from 'react';

type FormStepContainerProps = {
  children: ReactNode;
};

export const FormStepContainer = ({ children }: FormStepContainerProps) => {
  return <article className="flex flex-col md:gap-6 gap-4">{children}</article>;
};
