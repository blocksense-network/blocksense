import React from 'react';

import { ContractDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';
import { ContractOverview } from './ContractOverview';

export const ContractBaseInfo = ({ ...contract }: ContractDocItem) => {
  return (
    <>
      <AnchorLinkTitle title={contract.name} titleLevel={2} />
      <div className="contract-base-info border-solid border border-slate-200 bg-white shadow-md px-2 py-2 md:px-4 md:pt-4 pb-0 rounded-md mt-6 flex flex-col lg:flex-row items-start">
        <section className="contract-base-info__content w-full">
          <header className="contract-base-info__header px-2 py-2 mb-3 flex flex-col lg:flex-row justify-between lg:items-center">
            <h2 className="contract-base-info__base-contracts-title text-2xl mr-2 font-semibold text-gray-800">
              Overview
            </h2>

            <aside className="contract-base-info__description border-solid border border-slate-200 bg-slate-50 rounded-md font-bold px-4 py-2 mt-4 lg:mt-0">
              <dl className="contract-base-info__list flex flex-col lg:flex-row lg:items-center lg:space-x-6">
                <div
                  className={`contract-base-info__item flex items-center ${contract.contractKind === 'contract' ? 'mb-1 lg:mb-0' : 'mb-0'}`}
                >
                  <img
                    className="w-5 h-5 mr-2"
                    src="/icons/blocksense-kind.svg"
                    alt="Kind"
                    loading="lazy"
                  />
                  <dt className="contract-base-info__label text-gray-500 font-normal">
                    Kind:
                  </dt>
                  <dd className="contract-base-info__value text-gray-900 text-base ml-1">
                    {contract.contractKind}
                  </dd>
                </div>

                {contract.contractKind === 'contract' && (
                  <div className="contract-base-info__separator hidden lg:block w-[1px] bg-gray-900 h-6 mx-4"></div>
                )}

                {contract.contractKind === 'contract' && (
                  <div className="contract-base-info__item flex items-center">
                    <img
                      className="w-5 h-5 mr-2"
                      src="/icons/blocksense-abstract.svg"
                      alt="Abstract"
                      loading="lazy"
                    />
                    <dt className="contract-base-info__label text-gray-500 font-normal">
                      Abstract:
                    </dt>
                    <dd className="contract-base-info__value text-gray-900 text-base ml-1">
                      {contract.abstract.toString()}
                    </dd>
                  </div>
                )}
              </dl>
            </aside>
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
