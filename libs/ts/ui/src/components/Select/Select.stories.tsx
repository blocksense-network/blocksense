import React, { useState } from 'react';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
} from './Select';

export default {
  title: 'Components/Select',
  component: Select,
};

export const DefaultSelect = () => {
  const [selectedValue, setSelectedValue] = useState('');

  return (
    <Select value={selectedValue} onValueChangeAction={setSelectedValue}>
      <SelectTrigger className="btn">
        <SelectValue placeholder="Select an Item" />
      </SelectTrigger>
      <SelectContent>
        <SelectLabel>Items</SelectLabel>
        <SelectItem value="Item 1">Item 1</SelectItem>
        <SelectItem value="Item 2">Item 2</SelectItem>
        <SelectItem value="Item 3">Item 3</SelectItem>
      </SelectContent>
    </Select>
  );
};

export const SideAlignExamples = () => {
  const [defaultValue, setDefaultValue] = useState('');
  const [bottomCenterValue, setBottomCenterValue] = useState('');
  const [bottomEndValue, setBottomEndValue] = useState('');
  const [topStartValue, setTopStartValue] = useState('');
  const [topCenterValue, setTopCenterValue] = useState('');
  const [topEndValue, setTopEndValue] = useState('');

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-10">
        <Select value={defaultValue} onValueChangeAction={setDefaultValue}>
          <SelectTrigger className="btn">
            <SelectValue placeholder="Bottom Start (default)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Item 1">Item 1</SelectItem>
            <SelectItem value="Item 2">Item 2</SelectItem>
            <SelectItem value="Item 3">Item 3</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={bottomCenterValue}
          onValueChangeAction={setBottomCenterValue}
        >
          <SelectTrigger className="btn">
            <SelectValue placeholder="Bottom Center" />
          </SelectTrigger>
          <SelectContent align="center">
            <SelectItem value="Item 1">Item 1</SelectItem>
            <SelectItem value="Item 2">Item 2</SelectItem>
            <SelectItem value="Item 3">Item 3</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bottomEndValue} onValueChangeAction={setBottomEndValue}>
          <SelectTrigger className="btn">
            <SelectValue placeholder="Bottom End" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="Item 1">Item 1</SelectItem>
            <SelectItem value="Item 2">Item 2</SelectItem>
            <SelectItem value="Item 3">Item 3</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-10">
        <Select value={topStartValue} onValueChangeAction={setTopStartValue}>
          <SelectTrigger className="btn">
            <SelectValue placeholder="Top Start" />
          </SelectTrigger>
          <SelectContent side="top">
            <SelectItem value="Item 1">Item 1</SelectItem>
            <SelectItem value="Item 2">Item 2</SelectItem>
            <SelectItem value="Item 3">Item 3</SelectItem>
          </SelectContent>
        </Select>
        <Select value={topCenterValue} onValueChangeAction={setTopCenterValue}>
          <SelectTrigger className="btn">
            <SelectValue placeholder="Top Center" />
          </SelectTrigger>
          <SelectContent side="top" align="center">
            <SelectItem value="Item 1">Item 1</SelectItem>
            <SelectItem value="Item 2">Item 2</SelectItem>
            <SelectItem value="Item 3">Item 3</SelectItem>
          </SelectContent>
        </Select>
        <Select value={topEndValue} onValueChangeAction={setTopEndValue}>
          <SelectTrigger className="btn">
            <SelectValue placeholder="Top End" />
          </SelectTrigger>
          <SelectContent side="top" align="end">
            <SelectItem value="Item 1">Item 1</SelectItem>
            <SelectItem value="Item 2">Item 2</SelectItem>
            <SelectItem value="Item 3">Item 3</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

const countries = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'CA', name: 'Canada' },
  { code: 'FR', name: 'France' },
];

export const SelectCountry = () => {
  const [selectedCountry, setSelectedCountry] = useState('');

  return (
    <div className="flex items-center gap-10">
      <Select value={selectedCountry} onValueChangeAction={setSelectedCountry}>
        <SelectTrigger className="btn">
          <SelectValue placeholder="Select your country" />
        </SelectTrigger>
        <SelectContent side="bottom">
          {countries.map(country => (
            <SelectItem key={country.code} value={country.code}>
              <div className="flex items-center gap-2">
                <img
                  src={`https://flagcdn.com/w20/${country.code.toLocaleLowerCase()}.png`}
                  alt={country.name}
                  className="w-5 h-5"
                />
                <span>{country.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const paymentMethods = [
  { code: 'Visa', name: 'Visa', icon: '/icons/visa.svg' },
  { code: 'MasterCard', name: 'MasterCard', icon: '/icons/mastercard.svg' },
  { code: 'PayPal', name: 'PayPal', icon: '/icons/paypal.svg' },
  {
    code: 'American Express',
    name: 'American Express',
    icon: '/icons/amex.svg',
  },
];

export const SelectPaymentMethod = () => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');

  return (
    <div className="flex items-center gap-10">
      <Select
        value={selectedPaymentMethod}
        onValueChangeAction={setSelectedPaymentMethod}
      >
        <SelectTrigger className="btn">
          <SelectValue placeholder="Select your payment method" />
        </SelectTrigger>
        <SelectContent side="bottom" className="w-44">
          {paymentMethods.map(method => (
            <SelectItem key={method.code} value={method.code}>
              <div className="flex items-center gap-2">
                <img src={method.icon} alt={method.name} className="w-8 h-8" />
                <span>{method.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const sortingOptions = [
  { code: 'Sort by: Relevance', name: 'Relevance' },
  { code: 'Sort by: Price: Low to High', name: 'Price: Low to High' },
  { code: 'Sort by: Price: High to Low', name: 'Price: High to Low' },
  { code: 'Sort by: Newest', name: 'Newest' },
];

export const SelectSortingOption = () => {
  const [selectedSortingOption, setSelectedSortingOption] = useState('');

  return (
    <div className="flex items-center gap-10">
      <Select
        value={selectedSortingOption}
        onValueChangeAction={setSelectedSortingOption}
      >
        <SelectTrigger className="btn">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent side="bottom" className="w-56">
          {sortingOptions.map(option => (
            <SelectItem key={option.code} value={option.code}>
              <div className="flex items-center gap-2">
                <span>{option.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const statusOptions = [
  { code: 'Active', name: 'Active', icon: '/icons/active.svg' },
  { code: 'Inactive', name: 'Inactive', icon: '/icons/inactive.svg' },
  { code: 'Pending', name: 'Pending', icon: '/icons/pending.svg' },
  { code: 'Completed', name: 'Completed', icon: '/icons/completed.svg' },
];

export const SelectStatusFilter = () => {
  const [selectedStatus, setSelectedStatus] = useState('');

  return (
    <div className="flex items-center gap-10">
      <Select value={selectedStatus} onValueChangeAction={setSelectedStatus}>
        <SelectTrigger className="btn">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent side="bottom" className="w-56">
          {statusOptions.map(status => (
            <SelectItem key={status.code} value={status.code}>
              <div className="flex items-center gap-2">
                <img src={status.icon} alt={status.name} className="w-5 h-5" />
                <span>{status.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const roleOptions = [
  { code: 'Admin', name: 'Admin', icon: '/icons/admin.svg' },
  { code: 'User', name: 'User', icon: '/icons/user.svg' },
  { code: 'Guest', name: 'Guest', icon: '/icons/guest.svg' },
];

export const SelectRole = () => {
  const [selectedRole, setSelectedRole] = useState('');

  return (
    <div className="flex items-center gap-10">
      <Select value={selectedRole} onValueChangeAction={setSelectedRole}>
        <SelectTrigger className="btn">
          <SelectValue placeholder="Select a role" />
        </SelectTrigger>
        <SelectContent side="bottom" className="w-56">
          {roleOptions.map(role => (
            <SelectItem key={`${role.code}`} value={role.code}>
              <div className="flex items-center gap-2">
                <img src={role.icon} alt={role.name} className="w-5 h-5" />
                <span>{role.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const languages = [
  { code: 'GB', name: 'English' },
  { code: 'DE', name: 'German' },
  { code: 'ES', name: 'Spanish' },
  { code: 'FR', name: 'French' },
];

export const SelectLanguage = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('');

  return (
    <div className="flex items-center gap-10">
      <Select
        value={selectedLanguage}
        onValueChangeAction={setSelectedLanguage}
      >
        <SelectTrigger className="btn">
          <SelectValue placeholder="Select your language" />
        </SelectTrigger>
        <SelectContent side="bottom">
          {languages.map(language => (
            <SelectItem key={language.code} value={language.code}>
              <div className="flex items-center gap-2">
                <img
                  src={`https://flagcdn.com/w20/${language.code.toLocaleLowerCase()}.png`}
                  alt={language.name}
                  className="w-5 h-5"
                />
                <span>{language.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const themeOptions = [
  { code: 'Light', name: 'Light Mode', icon: '/icons/light_mode.svg' },
  { code: 'Dark', name: 'Dark Mode', icon: '/icons/dark_mode.svg' },
];

export const SelectTheme = () => {
  const [selectedTheme, setSelectedTheme] = useState('');

  return (
    <div className="flex items-center gap-10">
      <Select value={selectedTheme} onValueChangeAction={setSelectedTheme}>
        <SelectTrigger className="btn">
          <SelectValue placeholder="Pick a theme" />
        </SelectTrigger>
        <SelectContent side="bottom" className="w-56">
          {themeOptions.map(theme => (
            <SelectItem key={theme.code} value={theme.code}>
              <div className="flex items-center gap-2">
                <img src={theme.icon} alt={theme.name} className="w-5 h-5" />
                <span>{theme.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
