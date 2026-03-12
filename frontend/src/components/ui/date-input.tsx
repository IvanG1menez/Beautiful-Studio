"use client";

import { Input } from "@/components/ui/input";
import * as React from "react";

interface DateInputProps {
  value: Date | undefined;
  onChange: (date: Date) => void;
  className?: string;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  className,
}) => {
  const toInputValue = (date: Date | undefined): string => {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const [year, month, day] = val.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    onChange(date);
  };

  return (
    <Input
      type="date"
      value={toInputValue(value)}
      onChange={handleChange}
      className={className}
    />
  );
};
