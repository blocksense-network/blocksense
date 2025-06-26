'use client';

import React from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from '@blocksense/docs-ui/Dialog';
import { ScrollArea } from '@blocksense/docs-ui/ScrollArea';
import { CodeBlock } from '@/components/common/CodeBlock';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@blocksense/docs-ui/Drawer';
import { TriggerButton } from '@/components/sol-contracts/ABIModal/TriggerButton';
import { FormatButton } from '@/components/sol-contracts/ABIModal/FormatButton';
import { shikiDefaultThemes } from '@/config';

export interface AbiStruct {
  [key: string]: unknown;
  name?: string;
  type: string;
}

type ABIModalProps = {
  abi: AbiStruct | AbiStruct[];
  name?: string;
};

export const ABIModal = ({ abi, name = '' }: ABIModalProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isFormatted, setIsFormatted] = React.useState(true);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const title = `${name}`.trimStart();

  const getABI = () => {
    return isFormatted ? JSON.stringify(abi, null, 2) : JSON.stringify(abi);
  };

  const formatHandler = () => {
    setIsFormatted(state => !state);
  };

  if (!abi) return null;

  if (isDesktop) {
    return (
      <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <DialogTrigger onClick={() => setIsOpen(true)}>
          <section className="w-min">
            <TriggerButton tooltipContent={title} />
          </section>
        </DialogTrigger>
        <DialogContent className="max-w-screen-md">
          <DialogHeader>
            <section className="flex items-center justify-between px-2 pt-2 pb-0">
              <DialogTitle>{title}</DialogTitle>
              <FormatButton
                isFormatted={isFormatted}
                formatHandler={formatHandler}
              />
            </section>
          </DialogHeader>
          <ScrollArea className="border border-neutral-200 dark:border-neutral-600 rounded-lg max-h-[50vh] overflow-auto">
            <CodeBlock
              code={getABI()}
              lang="json"
              themes={shikiDefaultThemes.jsonThemes}
              className="abi-modal--pre"
            />
          </ScrollArea>
          <DialogClose />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger>
        <section className="w-min">
          <TriggerButton tooltipContent={title} />
        </section>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <section className="flex items-center justify-between text-left pl-2 pb-2">
            <DrawerTitle>{title}</DrawerTitle>
            <FormatButton
              isFormatted={isFormatted}
              formatHandler={formatHandler}
            />
          </section>
        </DrawerHeader>
        <ScrollArea className="border border-neutral-200 dark:border-neutral-600 rounded-md mx-4 mb-4">
          <CodeBlock
            code={getABI()}
            lang="json"
            themes={shikiDefaultThemes.jsonThemes}
            className="abi-modal--pre"
          />
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
};
