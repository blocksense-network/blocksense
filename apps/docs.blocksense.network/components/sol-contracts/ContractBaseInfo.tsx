import React from 'react';

import { ContractDocItem } from '@blocksense/sol-reflector';

import { ABIModal } from '@/sol-contracts-components/ABIModal/ABIModal';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractOverview } from './ContractOverview';
import { ImageWrapper } from '@/components/common/ImageWrapper';

export const ContractBaseInfo = ({ ...contract }: ContractDocItem) => {
  return (
    <>
      <AnchorLinkTitle title={contract.name} titleLevel={2} />
      <div className="contract-base-info border-solid border border-slate-200 bg-white shadow-md px-2 py-2 md:px-4 md:pt-4 pb-0 rounded-md mt-6 mb-6 flex flex-col lg:flex-row items-start">
        <section className="contract-base-info__content w-full">
          <header className="contract-base-info__header px-2 py-2 flex flex-col items-start mb-3 lg:flex-row lg:justify-between lg:items-center">
            <h2 className="contract-base-info__base-contracts-title text-2xl mr-2 font-semibold text-gray-800">
              Overview
            </h2>

            <div className="flex flex-col w-full justify-end lg:flex-row lg:items-center lg:space-x-2">
              <aside className="contract-base-info__description border-solid border border-slate-200 bg-slate-50 rounded-md font-bold px-4 py-1.5 mt-4 mb-2 md:mb-0 lg:my-0">
                <dl className="contract-base-info__list flex flex-col lg:flex-row lg:items-center lg:space-x-2">
                  <div
                    className={`contract-base-info__item flex items-center ${contract.contractKind === 'contract' ? 'mb-2 lg:mb-0' : 'mb-0'}`}
                  >
                    <ImageWrapper
                      src="/icons/blocksense-kind.svg"
                      alt="Kind"
                      className="relative w-5 h-5 mr-2"
                    />
                    <dt className="contract-base-info__label text-gray-500 font-normal">
                      Kind:
                    </dt>
                    <dd className="contract-base-info__value text-gray-900 text-base ml-1">
                      {contract.contractKind}
                    </dd>
                  </div>

                  {contract.contractKind === 'contract' && (
                    <>
                      {/* Separator between Kind and Abstract */}
                      <div className="contract-base-info__separator hidden lg:block w-[1px] bg-gray-900 h-4 mx-4"></div>

                      {/* Abstract section */}
                      <div className="contract-base-info__item flex items-center">
                        <ImageWrapper
                          src="/icons/blocksense-abstract.svg"
                          alt="Abstract"
                          className="relative w-5 h-5 mr-2"
                        />
                        <dt className="contract-base-info__label text-gray-500 font-normal">
                          Abstract:
                        </dt>
                        <dd className="contract-base-info__value text-gray-900 text-base ml-1">
                          {contract.abstract.toString()}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </aside>

              {/* Always show ABI button if ABI exists */}
              {contract.contractKind !== 'library' && (
                <div
                  className={`contract-base-info__item flex items-center ${contract.contractKind === 'contract' && !contract.abstract ? 'lg:ml-4' : ''}`}
                >
                  <ABIModal
                    abi={contract.abi}
                    name={`${contract.contractKind} ${contract.name}`}
                  />
                </div>
              )}
            </div>
          </header>
          {contract._baseContracts.length > 0 && (
            <section className="contract-base-info__content px-0 mb-4">
              <div className="contract-base-info__base-contracts">
                <h3 className="contract-base-info__base-contracts-title text-xl font-semibold text-gray-800 ml-2">
                  Base Contracts
                </h3>
                <ul className="contract-base-info__base-contracts-list ml-6 mt-2 mb-2 list-image-none list-outside text-gray-700">
                  {contract._baseContracts.map(baseContract => (
                    <li
                      className="contract-base-info__base-contracts-item"
                      key={baseContract}
                    >
                      {baseContract}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
          <aside className="contract-base-info__base-contracts-description mx-2">
            <ContractOverview contract={contract} />
          </aside>
          <footer className="contract-base-info__header mt-6 mx-2 mb-6">
            <NatSpec natspec={contract.natspec} />
          </footer>
        </section>
      </div>
    </>
  );
};
