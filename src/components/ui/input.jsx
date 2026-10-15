import React from "react";

export function Input({ 
  className = "", 
  type = "text", 
  disabled = false, 
  ...props 
}) {
  return (
    <input
      type={type}
      disabled={disabled}
      className={`flex h-10 w-full rounded-xl border border-white/10 bg-[#0B0F19]/60 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${className}`}
      {...props}
    />
  );
}

export default Input;
