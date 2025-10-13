import type { ReactNode } from 'react';

type FormStepContainerProps = {
  children: ReactNode;
};

export const FormStepContainer = ({ children }: FormStepContainerProps) => {
  return (
    <article className="form-step__container flex flex-col md:gap-6 gap-4">
      {children}
    </article>
  );
};
