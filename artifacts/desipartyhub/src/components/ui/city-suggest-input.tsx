import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";
import { searchCities, type USCity } from "@/lib/us-cities";

interface CitySuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  // Called (in addition to onChange) when the user picks a suggestion, so
  // the caller can auto-fill a paired State field.
  onCitySelect?: (city: string, state: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

// A plain text Input for City that shows a dropdown of matching US cities as
// the user types (same interaction pattern as the vendor search suggestions
// on /vendors), and reports the matched state back to the caller so a
// paired State field can be filled in automatically. Typing a city that
// isn't in the suggestion list still works fine - suggestions are just a
// shortcut, not a restriction on what can be entered.
export function CitySuggestInput({
  value,
  onChange,
  onCitySelect,
  placeholder,
  id,
  className,
}: CitySuggestInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const suggestions: USCity[] = value.trim().length >= 1 ? searchCities(value, 7) : [];

  useEffect(() => {
    setActiveSuggestion(-1);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectSuggestion = useCallback(
    (s: USCity) => {
      onChange(s.city);
      onCitySelect?.(s.city, s.state);
      setShowSuggestions(false);
    },
    [onChange, onCitySelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((i) => Math.max(i - 1, -1));
      } else if (e.key === "Enter" && activeSuggestion >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeSuggestion]);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    },
    [showSuggestions, suggestions, activeSuggestion, selectSuggestion]
  );

  const hasSuggestions = showSuggestions && suggestions.length > 0;

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        placeholder={placeholder}
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />

      {hasSuggestions && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto"
        >
          {suggestions.map((s, i) => (
            <button
              key={`${s.city}-${s.state}`}
              type="button"
              className={`w-full text-left px-4 py-2.5 flex items-center gap-2 transition-colors ${
                i === activeSuggestion ? "bg-primary/10 text-primary" : "hover:bg-muted/60"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(s);
              }}
              onMouseEnter={() => setActiveSuggestion(i)}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{s.city}</span>
              <span className="text-xs text-muted-foreground shrink-0">{s.state}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
