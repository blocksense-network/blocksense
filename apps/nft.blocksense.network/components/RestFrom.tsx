export const RestForm = () => {
  return (
    <form className="success-form w-full mx-auto flex flex-col items-center justify-center md:gap-8 gap-6 md:p-8 p-6 bg-[var(--black)] border border-[var(--gray-dark)] md:rounded-3xl rounded-2xl text-center">
      <article className="success-form__article flex flex-col md:gap-6 gap-5 justify-center items-center">
        <h3 className="success-form__title md:text-2xl text-base">
          {'🏴‍☠️ The ship’s crew is taking a quick nap!'}
        </h3>

        <p className="success-form__description md:text-base text-sm">
          We’re restocking the rum & patchin’ the sails. New recruits welcome
          aboard tomorrow — stay tuned!
        </p>
      </article>
    </form>
  );
};
