import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Components/Tabs',
  component: Tabs,
  argTypes: {
    defaultValue: { control: 'text', description: 'Default active tab value' },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: args => (
    <Tabs {...args} defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content | Tab 1</TabsContent>
      <TabsContent value="tab2">Content | Tab 2</TabsContent>
      <TabsContent value="tab3">Content | Tab 3</TabsContent>
    </Tabs>
  ),
};
