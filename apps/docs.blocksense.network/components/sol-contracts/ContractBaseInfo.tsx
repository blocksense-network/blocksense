import React from 'react';

import { ContractDocItem } from '@blocksense/sol-reflector';

import { ABIModal } from '@/sol-contracts-components/ABIModal/ABIModal';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractOverview } from './ContractOverview';
import { ImageWrapper } from '@blocksense/ui/ImageWrapper';
import { ContractAnchorLink } from '@/components/sol-contracts/ContractAnchorLink';

export const ContractBaseInfo = ({ ...contract }: ContractDocItem) => {
  return (
    <>
      <AnchorLinkTitle title={contract.name} titleLevel={2} />
      <div className="contract-base-info border-solid border border-slate-200 bg-white shadow-md px-2 py-2 md:px-4 md:pt-4 pb-0 rounded-md mt-6 mb-6 flex flex-col xl:flex-row items-start dark:bg-neutral-900 dark:border-neutral-600">
        <section className="contract-base-info__content w-full">
          <header className="contract-base-info__header px-2 py-2 flex [@media(max-width:1024px)]:flex-col items-start mb-3  xl:flex-row xl:justify-between xl:items-center">
            <h2 className="contract-base-info__base-contracts-title text-2xl mr-2 font-semibold text-gray-800 dark:text-white">
              Overview
            </h2>

            <div className="flex [@media(max-width:1024px)]:flex-col w-full justify-end lg:flex-row xl:items-center space-x-2">
              <aside className="contract-base-info__description border-solid border border-slate-200 bg-slate-50 rounded-md font-bold px-4 py-1.5 dark:bg-neutral-900 dark:border-neutral-600">
                <dl className="contract-base-info__list flex flex-row xl:items-center space-x-2">
                  <div
                    className={`contract-base-info__item flex items-center mb-0`}
                  >
                    <ImageWrapper
                      src="/icons/blocksense-kind.svg"
                      alt="Kind"
                      className="relative w-5 h-5 mr-2 invert"
                    />
                    <dt className="contract-base-info__label text-gray-500 font-normal dark:text-white">
                      Kind:
                    </dt>
                    <dd className="contract-base-info__value text-gray-900 text-base ml-1 dark:text-white">
                      {contract.contractKind}
                    </dd>
                  </div>

                  {contract.contractKind === 'contract' && (
                    <div className="contract-base-info__item flex items-center">
                      <ImageWrapper
                        src="/icons/blocksense-abstract.svg"
                        alt="Abstract"
                        className="relative w-5 h-5 mr-2 invert"
                      />
                      <dt className="contract-base-info__label text-gray-500 font-normal dark:text-white">
                        Abstract:
                      </dt>
                      <dd className="contract-base-info__value text-gray-900 text-base ml-1 dark:text-white">
                        {contract.abstract.toString()}
                      </dd>
                    </div>
                  )}
                </dl>
              </aside>

              {/* Always show ABI button if ABI exists */}
              {contract.contractKind !== 'library' && (
                <div
                  className={`contract-base-info__item flex items-center ${contract.contractKind === 'contract' && !contract.abstract ? 'xl:ml-4' : ''}`}
                >
                  <ABIModal
                    abi={contract.abi}
                    name={`${contract.signature?.codeSnippet}`}
                  />
                </div>
              )}
            </div>
          </header>
          {contract._baseContracts.length > 0 && (
            <section className="contract-base-info__content px-0 mb-4">
              <div className="contract-base-info__base-contracts">
                <h3 className="contract-base-info__base-contracts-title text-xl font-semibold text-gray-800 ml-2 dark:text-white">
                  Base Contracts
                </h3>
                <ul className="contract-base-info__base-contracts-list overview__list ml-6 mt-2 mb-2 list-image-none list-outside text-gray-700">
                  {contract._baseContracts.map(baseContract => (
                    <ContractAnchorLink
                      key={baseContract}
                      label={baseContract}
                    />
                  ))}
                </ul>
              </div>
            </section>
          )}
          <aside className="contract-base-info__base-contracts-description mx-2 pb-6">
            <ContractOverview contractString={JSON.stringify(contract)} />
          </aside>
          <footer className="contract-base-info__footer mt-6 mx-2 mb-6">
            <NatSpec natspec={contract.natspec} />
          </footer>
        </section>
      </div>
    </>
  );
};
