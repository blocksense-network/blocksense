import React from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogDescription,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CodeBlock } from '@/components/common/CodeBlock';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { TriggerButton } from '@/components/sol-contracts/ABIModal/TriggerButton';
import { FormatButton } from '@/components/sol-contracts/ABIModal/FormatButton';

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
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <section className="w-min">
            <TriggerButton tooltipContent={title} />
          </section>
        </DialogTrigger>
        <DialogContent className="h-4/6 max-w-screen-md">
          <DialogHeader>
            <section className="flex items-center justify-between px-2 pt-2 pb-0">
              <DialogTitle>{title}</DialogTitle>
              <FormatButton
                isFormatted={isFormatted}
                formatHandler={formatHandler}
              />
            </section>
            <DialogDescription />
          </DialogHeader>
          <ScrollArea>
            <CodeBlock code={getABI()} lang="json" theme="github-light" />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <section className="w-min">
          <TriggerButton tooltipContent={title} />
        </section>
      </DrawerTrigger>
      <DrawerContent>
        <DialogHeader>
          <section className="flex items-center justify-between px-4 py-2">
            <DialogTitle>{title}</DialogTitle>
            <FormatButton
              isFormatted={isFormatted}
              formatHandler={formatHandler}
            />
          </section>
          <DialogDescription />
        </DialogHeader>
        <div className="max-h-96 overflow-y-scroll pb-6">
          <CodeBlock code={getABI()} lang="json" theme="github-light" />
        </div>
      </DrawerContent>
    </Drawer>
  );
};
