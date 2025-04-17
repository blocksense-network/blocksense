import Image from 'next/image';

import successFormBlocksenseLogo from '/public/icons/success-form-blocksense-logo.svg';

export const SuccessForm = () => {
  return (
    <form className="w-full mx-auto flex flex-col items-center justify-center md:gap-8 gap-6 md:p-8 p-6 bg-[var(--gray-dark)] md:rounded-3xl rounded-2xl text-center">
      <Image
        src={successFormBlocksenseLogo}
        alt="Success Form Blocksense Logo"
      />
      <article className="flex flex-col gap-4">
        <h3 className="md:text-2xl text-base">
          Thank you for completing all the steps.
        </h3>
        <p className="md:max-w-[27.25rem] max-w-[18.875rem] md:text-base text-sm">
          Welcome to the Blocksense crew! <br />
          Glad to have you onboard. You are now part of
          <br /> the permissionless oracle revolution.
        </p>
      </article>
    </form>
  );
};
