import { NetworkLink } from './NetworkLink';

export const RestForm = () => {
  return (
    <form className="success-form w-full mx-auto flex flex-col items-center justify-center md:gap-8 gap-6 md:p-8 px-4 py-6 bg-[var(--black)] border border-[var(--gray-dark)] md:rounded-3xl rounded-2xl text-center">
      <article className="success-form__article flex flex-col md:gap-6 gap-5 justify-center items-center">
        <h3 className="success-form__title md:text-2xl text-base">
          All the crew’s onboard and the ship is sailing. 🏴‍☠️
        </h3>
        <p className="success-form__description md:text-base text-sm">
          You’ve claimed your flag. Now the real voyage begins! <br /> Missed
          the ship? Don’t be sad—you can still join the community and become
          part of the Blocksense crew.
        </p>
      </article>
      <section className="flex md:flex-row flex-col md:gap-4 gap-2 w-full text-left">
        <NetworkLink type="x" />
        <NetworkLink type="discord" />
      </section>
    </form>
  );
};
