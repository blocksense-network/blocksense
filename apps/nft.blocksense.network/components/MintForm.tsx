'use client';

import { FormStepTitle } from './FormStepTitle';
import { FormStepContainer } from './FormStepContainer';
import { NetworkLink } from './NetworkLink';
import { Separator } from './Separator';
import { RetweetCard } from './RetweetCard';
import { AlertMessage } from './AlertMessage';
import { XHandle } from './XHandle';
import { Discord } from './Discord';
import { MintMyNFTButton } from './MintMyNFTButton';
import { ConnectSignButtons } from './ConnectSignButtons';

const separatorClassName = 'mint-form__separator md:my-8 my-6';

type MintFormProps = {
  onSuccessAction: (
    mintTransactionUrl: string,
    isAlreadyMinted: boolean,
  ) => void;
};

export const MintForm = ({ onSuccessAction }: MintFormProps) => {
  return (
    <form className="mint-form border border-[var(--gray-dark)] md:rounded-3xl rounded-2xl md:p-8 px-4 py-6">
      <FormStepContainer>
        <FormStepTitle title="Follow us on X and join our Discord" number={1} />
        <section className="flex md:flex-row flex-col md:gap-4 gap-2">
          <NetworkLink type="x" />
          <NetworkLink type="discord" />
        </section>
      </FormStepContainer>
      <Separator className={separatorClassName} />
      <FormStepContainer>
        <FormStepTitle
          title="Enter your social handles for verification"
          number={2}
        />
        <section className="flex flex-col md:gap-8 gap-6">
          <section className="flex flex-col md:gap-[0.875rem] gap-2">
            <XHandle />
            <Discord />
          </section>
          <ConnectSignButtons />
        </section>
      </FormStepContainer>
      <Separator className={separatorClassName} />
      <FormStepContainer>
        <FormStepTitle
          title="Share our announcement with your unique code"
          number={3}
        />
        <RetweetCard />
      </FormStepContainer>
      <MintMyNFTButton onSuccessAction={onSuccessAction} />
      <AlertMessage />
    </form>
  );
};
