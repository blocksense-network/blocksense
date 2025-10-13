type FormStepTitleProps = {
  title: string;
  number: number;
};

export const FormStepTitle = ({ number, title }: FormStepTitleProps) => {
  return (
    <section className="form-step__title flex items-center md:gap-4 gap-3">
      <span className="form-step__title-number bg-[var(--white)] text-[var(--black)] md:text-xl text-base p-[0.625rem] rounded-full md:w-8 md:h-8 w-6 h-6 flex items-center justify-center">
        {number}
      </span>
      <h4 className="form-step__title-text">{title}</h4>
    </section>
  );
};
