import React from "react";

export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[#111827] text-white shadow-xl transition-all duration-300 hover:border-orange-500/40 hover:shadow-2xl hover:shadow-orange-500/5 flex flex-col justify-between overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }) {
  return <div className={`p-5 pb-2 ${className}`} {...props}>{children}</div>;
}

export function CardTitle({ className = "", children, ...props }) {
  return <h3 className={`font-bold text-base text-white tracking-tight ${className}`} {...props}>{children}</h3>;
}

export function CardContent({ className = "", children, ...props }) {
  return <div className={`p-5 pt-0 space-y-2 text-xs text-gray-400 ${className}`} {...props}>{children}</div>;
}

export function CardFooter({ className = "", children, ...props }) {
  return <div className={`p-5 pt-0 mt-auto ${className}`} {...props}>{children}</div>;
}
