import * as React from 'react';
import { ReactNode } from 'react';

import { links } from '../../constants/links';
import { renderEmail } from '../../utils/renderEmail';

type ResourceLinkProps = {
  href: string;
  children: ReactNode;
};

const ResourceLink = ({ href, children }: ResourceLinkProps) => (
  <li className="mb-[8px]">
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#1A57FF] underline"
    >
      {children}
    </a>
  </li>
);

type SocialCardProps = {
  href: string;
  stat: string;
  label: string;
  cta: string;
};

const SocialCard = ({ href, stat, label, cta }: SocialCardProps) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="no-underline text-inherit block"
  >
    <article className="bg-[#2c2c2c] rounded-[16px] p-[12px] text-white">
      <h2 className="m-0 text-[16px] text-white">{stat}</h2>
      <p className="m-0 text-[12px] text-[#F4F3F3] whitespace-nowrap">
        {label}
      </p>
      <p className="m-0 mt-[6px] text-[10px] text-[#D2D2D2]">{cta}</p>
    </article>
  </a>
);

export type LetsTalkEmailProps = {
  name: string;
};

export const LetsTalkEmail = ({ name }: LetsTalkEmailProps) => {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      className="w-full m-0 p-0"
    >
      <tbody>
        <tr>
          <td>
            <div className="max-w-[600px] mx-auto bg-[#ffffff] rounded-[16px] p-[24px] text-[#171717]">
              <h1 className="m-0 mb-[12px] text-[24px]">
                Welcome aboard the Blocksense ship 🏴‍☠️
              </h1>

              <p className="m-0 mb-[12px] text-[16px]">Hi {name},</p>

              <p className="m-0 mb-[12px] text-[16px]">
                Thanks for contacting us through our{' '}
                <a
                  href={links.website.letsTalk}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1A57FF] underline"
                >
                  let's talk form
                </a>
                . We'll be in touch soon to learn more about your use case and
                how Blocksense can help.
              </p>

              <p className="m-0 mb-[12px] text-[16px]">
                In the meantime, the best way to stay in the loop is to join the
                crew:
              </p>

              <ul className="m-0 pl-[20px] list-disc list-outside pb-[20px]">
                <ResourceLink href={links.docs.home}>
                  Explore the Docs
                </ResourceLink>
                <ResourceLink href={links.website.litepaper}>
                  Read the Litepaper
                </ResourceLink>
                <ResourceLink href={links.repos.blocksenseOS}>
                  Learn about BlocksenseOS
                </ResourceLink>
              </ul>

              <table
                role="presentation"
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                border={0}
              >
                <tbody>
                  <tr>
                    <td
                      align="left"
                      valign="top"
                      width="50%"
                      className="pr-[8px]"
                    >
                      <SocialCard
                        href={links.social.x}
                        stat="70K+"
                        label="FOLLOWERS ON X"
                        cta="Follow us on X"
                      />
                    </td>
                    <td
                      align="left"
                      valign="top"
                      width="50%"
                      className="pl-[8px]"
                    >
                      <SocialCard
                        href={links.social.discord}
                        stat="80K+"
                        label="COMMUNITY MEMBERS"
                        cta="Become a member"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              <p className="text-[16px] mt-[16px]">See you on board.</p>
              <p className="m-0 mt-[2px] text-[12px] text-[#3A3A3A]">
                - The Blocksense Team
              </p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export function renderLetsTalkEmail(name: string) {
  return renderEmail(<LetsTalkEmail name={name} />);
}
