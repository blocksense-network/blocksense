import { useState, useEffect, useRef, ReactNode } from 'react';
import cn from 'clsx';

type DropdownProps = {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Dropdown({ trigger, children, className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleDropdown = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsOpen(prevIsOpen => !prevIsOpen);
  };

  return (
    <div ref={dropdownRef} className={cn('nx-dropdown-container', className)}>
      <div className="nx-dropdown-trigger" onClick={toggleDropdown}>
        {trigger}
      </div>
      {isOpen && <div className="nx-dropdown-menu">{children}</div>}
    </div>
  );
}
