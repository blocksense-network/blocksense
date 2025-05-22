'use client';

import Image from 'next/image';
import { Button } from './Button';

interface FeatureCardProps {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
}

export const FeatureCard = ({
  title,
  description,
  imageSrc,
  imageAlt,
  imageWidth,
  imageHeight,
}: FeatureCardProps) => {
  return (
    <section className="flex items-center justify-between py-16 px-30 h-[30.29rem]">
      <article className="flex w-[27.5rem] flex-col justify-center items-start gap-6">
        <h2 className="text-4xl leading-tight">{title}</h2>
        <p className="text-[1.25rem] font-normal">{description}</p>
        <Button>Start building</Button>
      </article>

      <Image
        src={imageSrc}
        alt={imageAlt}
        width={imageWidth}
        height={imageHeight}
        unoptimized
        priority
        quality={100}
      />
    </section>
  );
};
