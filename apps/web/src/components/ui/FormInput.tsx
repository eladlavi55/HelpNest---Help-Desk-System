import type { InputHTMLAttributes } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

const inputBase =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 " +
  "placeholder:text-slate-400 transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export function FormInput({ label, id, className = "", ...props }: FormInputProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <input id={id} {...props} className={`${inputBase} ${className}`} />
    </div>
  );
}
