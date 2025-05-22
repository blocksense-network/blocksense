'use client';

import { motion, useScroll, useSpring } from 'motion/react';
import { useRef } from 'react';

import { FeatureCard } from 'components/FeatureCard';

const features = [
  {
    title: 'Developer-first integration',
    description:
      'Integrate Blocksense feeds using a clean, standardized EVM contract. The interface is fully compatible with Chainlink-style oracles, requiring minimal changes to your existing codebase or tooling.',
    imageSrc: '/images/developer-integration.svg',
    imageAlt: 'Illustration of developer-first integration',
  },
  {
    title: 'Cryptographic data guarantees',
    description:
      'Every feed update is verified through SchellingCoin-based secret voting and zero-knowledge proofs. You get full transparency and security without relying on reputation or centralized publishers.',
    imageSrc: '/images/cryptographic-guarantees.svg',
    imageAlt: 'Illustration of cryptographic data guarantees',
  },
  {
    title: 'Custom feed creation via SDK',
    description:
      'Create feeds with custom logic using our SDK for permissionless data feed creation. Define sources, filters and thresholds to match your protocol’s specific needs, from niche assets to novel markets.',
    imageSrc: '/images/custom-feed-sdk.svg',
    imageAlt: 'Illustration of custom feed creation via SDK',
  },
  {
    title: 'Built to scale with your protocol',
    description:
      'Blocksense is optimized for performance across hundreds or thousands of feeds. On-chain reads remain efficient, with predictable gas costs and a consistent developer experience at every stage.',
    imageSrc: '/images/scalable-protocol.svg',
    imageAlt: 'Illustration of scalability for protocols',
  },
];

export const ProductFeatures = () => {
  const contentRef = useRef<HTMLDivElement>(null); // Reference to the Content component
  const { scrollYProgress } = useScroll({
    target: contentRef,
    offset: ['start start', 'end end'], // Start when the top of Content hits the viewport
  });

  const scaleY = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <section style={{ position: 'relative' }}>
      <div className="absolute top-0 left-0 bottom-0 w-1 bg-[var(--Grey,#ECECEB)] opacity-30" />
      <motion.div
        id="scroll-indicator"
        className="absolute top-0 left-0 bottom-0 w-1 origin-top bg-[#EEFF00]"
        style={{
          scaleY,
        }}
      />
      <section ref={contentRef}>
        {features.map((feature, index) => {
          return (
            <FeatureCard
              key={index}
              title={feature.title}
              description={feature.description}
              imageSrc={feature.imageSrc}
              imageAlt={feature.imageAlt}
              imageWidth={495}
              imageHeight={296.033}
            />
          );
        })}
      </section>
    </section>
  );
};
