import React from "react";

export function Label({ children, className = "", htmlFor, ...props }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-1.5 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}

export default Label;
