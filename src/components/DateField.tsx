import { useEffect, useState, useMemo } from "react";
import { format, isValid, parse } from "date-fns";
import { srLatn } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { CalendarIcon } from "lucide-react";
import type { CaptionProps } from "react-day-picker";
import { useDayPicker } from "react-day-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const INPUT_FORMATS = ["dd.MM.yyyy", "d.M.yyyy", "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "yyyy-MM-dd"];

function parseManual(value: string): Date | null {
  const raw = value.trim().replace(/\.$/, "");
  if (!raw) return null;
  for (const fmt of INPUT_FORMATS) {
    const parsed = parse(raw, fmt, new Date());
    if (isValid(parsed)) return parsed;
  }
  return null;
}

interface DateFieldProps {
  value: Date | undefined;
  onChange: (date: Date) => void;
  className?: string;
  fromYear?: number;
  toYear?: number;
  disabled?: boolean;
}

export function DateField({ value, onChange, className, fromYear, toYear, disabled }: DateFieldProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value ? format(value, "dd.MM.yyyy") : "");
  const [month, setMonth] = useState<Date>(value ?? new Date());

  useEffect(() => {
    setText(value ? format(value, "dd.MM.yyyy") : "");
    if (value) setMonth(value);
  }, [value?.getTime()]);

  const commit = () => {
    const parsed = parseManual(text);
    if (parsed) {
      onChange(parsed);
      setText(format(parsed, "dd.MM.yyyy"));
    } else {
      setText(value ? format(value, "dd.MM.yyyy") : "");
    }
  };

  const currentYear = new Date().getFullYear();
  const locale = i18n.language === "sr" ? srLatn : undefined;

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        value={text}
        disabled={disabled}
        inputMode="numeric"
        placeholder="dd.mm.gggg"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" disabled={disabled} aria-label="Open calendar">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            month={month}
            onSelect={(d) => {
              if (d) {
                onChange(d);
                setOpen(false);
              }
            }}
            onMonthChange={setMonth}
            captionLayout="dropdown-buttons"
            fromYear={fromYear ?? currentYear - 10}
            toYear={toYear ?? currentYear + 5}
            locale={locale}
            initialFocus
            className="p-3 pointer-events-auto"
            classNames={{
              caption: "flex justify-center pt-1 relative items-center gap-1",
              caption_dropdowns: "flex gap-1",
              dropdown:
                "rounded-md border border-border bg-popover text-foreground text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring",
              dropdown_month: "relative",
              dropdown_year: "relative",
              vhidden: "hidden",
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
