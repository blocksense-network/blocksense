'use client';

import React from 'react';
import { createContext, useContext, useState, ReactNode } from 'react';

import { cn } from '@blocksense/ui/utils';

type TabsContextType = {
  activeTab: string;
  setActiveTab: (value: string) => void;
};

const TabsContext = createContext<TabsContextType>({
  activeTab: '',
  setActiveTab: () => {},
});

export const Tabs = ({
  children,
  defaultValue,
}: {
  children: ReactNode;
  defaultValue: string;
}) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
};

export const TabsList = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      'tabs__list inline-flex h-10 items-center justify-center bg-muted p-1 dark:bg-neutral-900',
      className,
    )}
  >
    {children}
  </div>
);

export const TabsTrigger = ({
  className,
  value,
  children,
}: {
  className?: string;
  value: string;
  children: ReactNode;
}) => {
  const { activeTab, setActiveTab } = useContext(TabsContext);

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        'tabs__trigger inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 mb-2 text-sm font-medium ring-offset-background transition-all duration-200 ease-in-out disabled:pointer-events-none disabled:opacity-50',
        activeTab === value
          ? 'tabs__trigger--active active tabs__trigger-selected border border-solid bg-background shadow-md border-blue-500 text-foreground'
          : 'tabs__trigger--inactive border border-solid border-neutral-200',
        className,
      )}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({
  className,
  value,
  children,
}: {
  className?: string;
  value: string;
  children: ReactNode;
}) => {
  const { activeTab } = useContext(TabsContext);

  return (
    <div
      className={cn(
        'tabs__content mt-2 px-2 py-2 bg-white border-solid border-neutral-200 dark:bg-neutral-900 transition-opacity duration-200 ease-in-out',
        activeTab === value
          ? 'tabs__content--active active opacity-100'
          : 'tabs__content--inactive opacity-0 hidden',
        className,
      )}
    >
      {children}
    </div>
  );
};

Tabs.displayName = 'Tabs';
TabsList.displayName = 'TabsList';
TabsTrigger.displayName = 'TabsTrigger';
TabsContent.displayName = 'TabsContent';
