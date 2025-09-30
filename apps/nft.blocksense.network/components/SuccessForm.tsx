import Image from 'next/image';

import exploreIcon from '/public/icons/explore.svg';
import successFormBlocksenseLogo from '/public/icons/success-form-blocksense-logo.svg';

type SuccessFormProps = {
  mintTransactionUrl: string;
  isAlreadyMinted: boolean;
};

export const SuccessForm = ({
  isAlreadyMinted,
  mintTransactionUrl,
}: SuccessFormProps) => {
  return (
    <form className="success-form w-full mx-auto flex flex-col items-center justify-center md:gap-8 gap-6 md:p-8 p-6 bg-[var(--gray-dark)] md:rounded-3xl rounded-2xl text-center">
      <Image
        src={successFormBlocksenseLogo}
        alt="Success Form Blocksense Logo"
        className="success-form__blocksense-logo"
      />
      <article className="success-form__article flex flex-col md:gap-6 gap-5 justify-center items-center">
        <h3 className="success-form__title md:text-2xl text-base">
          {isAlreadyMinted
            ? 'You have already minted your NFT'
            : 'Thank you for completing all the steps.'}
        </h3>
        <p className="success-form__description md:text-base text-sm">
          Welcome to the Blocksense crew! <br />
          You are now part of the permissionless oracle revolution.
        </p>
        <a
          href={mintTransactionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit flex justify-center items-center gap-1 cursor-pointer"
        >
          <Image
            src={exploreIcon}
            alt="Explore"
            className="success-form__explore-icon"
          />
          <p className="text-[var(--white)] underline md:text-base text-sm leading-[1.225rem]">
            Explore your minting transaction
          </p>
        </a>
      </article>
    </form>
  );
};
