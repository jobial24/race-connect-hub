import React from "react";

export function Button({ 
  children, 
  className = "", 
  variant = "default", 
  size = "default", 
  type = "button", 
  disabled = false, 
  ...props 
}) {
  const base = "inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
  
  const variants = {
    default: "bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 active:scale-[0.98]",
    secondary: "bg-white/10 hover:bg-white/15 text-white border border-white/10",
    outline: "border border-white/20 hover:border-white/40 text-gray-200 hover:bg-white/5",
    ghost: "text-gray-300 hover:text-white hover:bg-white/5",
  };

  const sizes = {
    default: "h-10 px-4 py-2 rounded-xl text-sm",
    sm: "h-8 px-3 rounded-lg text-xs",
    lg: "h-12 px-6 rounded-xl text-base",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
