import { useState, ReactNode, useEffect } from 'react';
import cn from 'clsx';

type DropdownProps = {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Dropdown({ trigger, children, className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.nx-dropdown-container')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsOpen(prev => !prev);
  };

  return (
    <div className={cn('nx-dropdown-container', className)}>
      {trigger && (
        <div className="nx-dropdown-trigger" onClick={handleToggle}>
          {trigger}
        </div>
      )}
      {isOpen && (
        <div
          className={cn('nx-dropdown-menu', {
            'nx-dropdown-menu-open': isOpen,
          })}
        >
          {children}
        </div>
      )}
    </div>
  );
}
