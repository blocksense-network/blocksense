import { ReactNode, HTMLAttributes, ComponentProps } from 'react';

import { Command as CommandPrimitive } from 'cmdk';

import { cn } from '@/lib/utils';
import { Icon } from '@blocksense/ui/Icon';
import { Dialog, DialogContent } from '@blocksense/ui/Dialog';

export const Command = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive>) => (
  <CommandPrimitive
    className={cn(
      'command__container flex h-full w-full flex-col overflow-hidden rounded-md',
      className,
    )}
    {...props}
    aria-label="Command Menu"
  />
);

export const CommandDialog = ({
  children,
  ...props
}: {
  children: ReactNode;
}) => {
  return (
    <Dialog {...props}>
      <DialogContent className="command-dialog__content overflow-hidden p-0 shadow-lg">
        <Command
          className="command__wrapper [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          aria-labelledby="command-dialog"
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

export const CommandInput = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Input>) => (
  <div
    className="command-input__container flex items-center pb-2 border-b px-3 border-neutral-200 bg-white dark:bg-neutral-900 dark:border-neutral-600"
    cmdk-input-wrapper=""
    aria-label="Search Command"
  >
    <Icon
      className="command-input__icon mr-2 mt-1 h-4 w-4 shrink-0 opacity-50 invert"
      size="xs"
      icon={{
        type: 'image',
        src: '/icons/search.svg',
      }}
      ariaLabel="Escape"
    />
    <CommandPrimitive.Input
      className={cn(
        'command-input__field flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
      aria-label="Command Input"
    />
  </div>
);

export const CommandList = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.List>) => (
  <CommandPrimitive.List
    className={cn(
      'command-list__container max-h-[300px] overflow-y-auto overflow-x-hidden',
      className,
    )}
    {...props}
    aria-label="Command List"
  />
);

export const CommandEmpty = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>) => (
  <CommandPrimitive.Empty
    className="command-empty__text py-6 text-center text-sm"
    {...props}
    aria-label="No Results"
  />
);

export const CommandGroup = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) => (
  <CommandPrimitive.Group
    className={cn(
      'command-group__container overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium',
      className,
    )}
    {...props}
    aria-label="Command Group"
  />
);

export const CommandSeparator = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Separator>) => (
  <CommandPrimitive.Separator
    className={cn('command-separator__line -mx-1 h-px bg-border', className)}
    {...props}
    aria-hidden="true"
  />
);

export const CommandItem = ({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Item>) => (
  <CommandPrimitive.Item
    className={cn(
      "command-item__container relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none dark:data-[selected='true']:bg-neutral-800 data-[selected='true']:bg-neutral-200/50 dark:data-[selected=true]:text-white data-[disabled=true]:opacity-50",
      className,
    )}
    {...props}
    aria-label="Command Item"
  />
);

export const CommandShortcut = ({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      'command-shortcut__text ml-auto text-xs tracking-widest',
      className,
    )}
    {...props}
    aria-label="Command Shortcut"
  />
);

Command.displayName = CommandPrimitive.displayName;
CommandDialog.displayName = 'CommandDialog';
CommandInput.displayName = CommandPrimitive.Input.displayName;
CommandList.displayName = CommandPrimitive.List.displayName;
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;
CommandGroup.displayName = CommandPrimitive.Group.displayName;
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;
CommandItem.displayName = CommandPrimitive.Item.displayName;
CommandShortcut.displayName = 'CommandShortcut';
