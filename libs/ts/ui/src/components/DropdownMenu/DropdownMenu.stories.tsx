import React, { useState } from 'react';

import { Button } from '@blocksense/ui/Button';
import { RadioGroup, RadioGroupItem } from '@blocksense/ui/RadioGroup';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSubTrigger,
} from './DropdownMenu';
import { Separator } from '@blocksense/ui';

export default {
  title: 'Components/DropdownMenu',
  component: DropdownMenu,
};

export const DefaultDropdown = () => {
  return (
    <div className="p-4">
      <DropdownMenu>
        <DropdownMenuTrigger className="px-3 py-2 bg-blue-600 text-white rounded cursor-pointer">
          Open Default
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Items</DropdownMenuLabel>
          <DropdownMenuItem>Item One</DropdownMenuItem>
          <DropdownMenuItem>Item Two</DropdownMenuItem>
          <Separator className="dropdown-menu__separator my-1" />
          <DropdownMenuItem>Item Three</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export const SideAlignExamples = () => {
  return (
    <div className="p-4 flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button>Bottom Start (default)</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="start">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button>Bottom Center</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="center">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button>Bottom End</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button>Top Start</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button>Top Center</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button>Top End</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button>Left Start</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="left" align="start">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button>Left Center</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="left" align="center">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button>Left End</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="left" align="end">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button>Right Start</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button>Right Center</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="center">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button>Right End</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export const CheckboxExample = () => {
  const [optionA, setOptionA] = useState(false);
  const [optionB, setOptionB] = useState(false);

  return (
    <div className="p-4">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button>Open Checkbox Menu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start">
          <DropdownMenuCheckboxItem
            checked={optionA}
            onCheckedChange={setOptionA}
          >
            {`Option A ${optionA ? '(On)' : '(Off)'}`}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={optionB}
            onCheckedChange={setOptionB}
          >
            {`Option B ${optionB ? '(On)' : '(Off)'}`}
          </DropdownMenuCheckboxItem>
          <DropdownMenuItem>Another Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export const RadioExample = () => {
  const [selectedOption, setSelectedOption] = useState('option1');

  return (
    <div className="p-4">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button>Open Radio Menu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start">
          <RadioGroup
            selectedValue={selectedOption}
            name="option"
            onValueChangeAction={setSelectedOption}
            aria-label="Choose an option"
            className="p-4"
          >
            <RadioGroupItem value="option1">Option 1</RadioGroupItem>
            <RadioGroupItem value="option2">Option 2</RadioGroupItem>
            <RadioGroupItem value="option3">Option 3</RadioGroupItem>
          </RadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export const SubmenuExample = () => {
  return (
    <div className="p-4">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button>Open Submenu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Main Item</DropdownMenuItem>
          <Separator className="dropdown-menu__separator my-1" />
          <DropdownMenuSubTrigger
            submenu={
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuItem>Sub Item 1</DropdownMenuItem>
                <DropdownMenuItem>Sub Item 2</DropdownMenuItem>
              </DropdownMenuContent>
            }
          >
            Submenu
          </DropdownMenuSubTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
