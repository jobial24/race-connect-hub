import React from "react";

export function Badge({ children, variant = "default", className = "", ...props }) {
  const variants = {
    default: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    secondary: "bg-black/60 text-gray-200 border-white/10 backdrop-blur-md",
    price: "bg-black/75 text-orange-400 font-bold border-white/10 backdrop-blur-md",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border font-medium ${variants[variant] || variants.default} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
