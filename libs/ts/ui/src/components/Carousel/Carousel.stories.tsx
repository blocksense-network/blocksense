import React from 'react';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from './Carousel';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../Card';

export default {
  title: 'Components/Carousel',
  component: Carousel,
};

const cards = [
  {
    title: 'Card 1',
    description: 'Card 1 Description',
    content: 'Card 1 content.',
  },
  {
    title: 'Card 2',
    description: 'Card 2 Description',
    content: 'Card 2 content.',
  },
  {
    title: 'Card 3',
    description: 'Card 3 Description',
    content: 'Card 3 content.',
  },
];

const CarouselCard = ({
  title,
  description,
  content,
}: {
  title: string;
  description: string;
  content: string;
}) => (
  <CarouselItem>
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p>{content}</p>
      </CardContent>
    </Card>
  </CarouselItem>
);

export const CarouselHorizontal = () => {
  return (
    <Carousel>
      <CarouselContent>
        {cards.map((card, index) => (
          <CarouselCard key={index} {...card} />
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
};

export const CarouselVertical = () => {
  return (
    <Carousel orientation="vertical">
      <CarouselContent className="h-[400px]">
        {cards.map((card, index) => (
          <CarouselCard key={index} {...card} />
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
};
