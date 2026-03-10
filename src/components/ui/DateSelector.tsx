import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateSelectorProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
}

export const DateSelector: React.FC<DateSelectorProps> = ({ selectedDate, onChange }) => {
  // Get Sunday as start of week (Hebrew week)
  const startOfWeek = new Date(selectedDate);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  // Get days array Sun-Sat
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    // Use noon to avoid UTC date rollback across timezones
    d.setHours(12, 0, 0, 0);
    return d;
  });

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

  const goByDays = (daysToMove: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + daysToMove);
    // Keep noon to preserve local day when converted to ISO (UTC)
    next.setHours(12, 0, 0, 0);
    onChange(next);
  };

  const goPrevWeek = () => goByDays(-7);
  const goNextWeek = () => goByDays(7);

  // Hebrew weekday single-letter labels, Sunday-first
  const hebrewWeekLetters = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

  return (
    <div dir="rtl" className="sticky top-0 z-10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b border-gray-100">
      <div className="flex items-center justify-between px-2 py-2">
        <button
          aria-label="שבוע קודם"
          onClick={goPrevWeek}
          className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* 7-column grid to show all days on mobile */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 w-full px-1">
          {days.map((day) => {
            const selected = isSameDay(day, selectedDate);
            const weekdayLetter = hebrewWeekLetters[day.getDay()];
            return (
              <button
                key={day.toDateString()}
                onClick={() => {
                  const clicked = new Date(day);
                  clicked.setHours(12, 0, 0, 0);
                  onChange(clicked);
                }}
                className={`h-14 sm:h-16 flex flex-col items-center justify-center rounded-xl text-sm border transition-all duration-150 ${
                  selected
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span className={`text-[11px] leading-3 font-medium ${selected ? "text-white/90" : "text-gray-500"}`}>
                  {weekdayLetter}
                </span>
                <span className="text-base font-bold mt-1">
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        <button
          aria-label="שבוע הבא"
          onClick={goNextWeek}
          className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};