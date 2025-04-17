type FormStepTitleProps = {
  title: string;
  number: number;
};

export const FormStepTitle = ({ title, number }: FormStepTitleProps) => {
  return (
    <section className="flex items-center md:gap-4 gap-3">
      <span className="bg-[var(--white)] text-[var(--black)] md:text-xl text-base p-[0.625rem] rounded-full md:w-8 md:h-8 w-6 h-6 flex items-center justify-center">
        {number}
      </span>
      <h4>{title}</h4>
    </section>
  );
};
