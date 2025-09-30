import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'bordered', 'shadow', 'transparent'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    className: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    variant: 'default',
    size: 'md',
    children: (
      <Card>
        <CardContent>
          <p>This card has only content, without a header or footer.</p>
        </CardContent>
      </Card>
    ),
  },
};

export const Bordered: Story = {
  args: {
    variant: 'bordered',
    size: 'md',
    children: (
      <Card>
        <CardHeader>
          <CardTitle>Bordered Card</CardTitle>
          <CardDescription>This card has a border.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Some bordered card content.</p>
        </CardContent>
      </Card>
    ),
  },
};

export const Shadow: Story = {
  args: {
    variant: 'shadow',
    size: 'md',
    children: (
      <Card>
        <CardHeader>
          <CardTitle>Shadow Card</CardTitle>
          <CardDescription>This card has a shadow effect.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Shadow card content goes here.</p>
        </CardContent>
      </Card>
    ),
  },
};

export const Transparent: Story = {
  args: {
    variant: 'transparent',
    size: 'md',
    children: (
      <Card>
        <CardHeader>
          <CardTitle>Transparent Card</CardTitle>
          <CardDescription>This card is transparent.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Transparent card content.</p>
        </CardContent>
      </Card>
    ),
  },
};

export const CardWithFooter: Story = {
  args: {
    variant: 'default',
    size: 'md',
    children: (
      <Card>
        <CardContent>
          <p>This card has a footer.</p>
        </CardContent>
        <CardFooter>
          <p>Footer content goes here.</p>
        </CardFooter>
      </Card>
    ),
  },
};
