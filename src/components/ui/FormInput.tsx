import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: React.ReactNode;
  containerClassName?: string;
  labelClassName?: string;
  onChangeValue?: (val: string) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, containerClassName, labelClassName, className, onChangeValue, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChangeValue) onChangeValue(e.target.value);
      if (onChange) onChange(e);
    };

    return (
      <div className={cn("group space-y-1", containerClassName)}>
        {label && (
          <label className={cn("text-[9px] text-[#5a5548] font-black uppercase block", labelClassName)}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          onChange={handleChange}
          inputMode={props.type === 'number' ? 'decimal' : props.inputMode}
          className={cn(
            "w-full bg-[#080a0f] border border-[#1a1e2a] rounded-xl p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55] transition-all", 
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';
