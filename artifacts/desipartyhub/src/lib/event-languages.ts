// Fixed language list for the Events feature, picked from a dropdown on the
// submit form (same pattern as EVENT_CATEGORIES). Lets users filter events
// by language/community the way Sulekha Events tags each listing (Gujarati,
// Hindi, Tamil, etc.) - useful since a "Navratri/Dandiya" event and a
// "Carnatic Music" event are both "Cultural Festival" / "Concert" category
// but appeal to very different audiences.
export const EVENT_LANGUAGES = [
  "Hindi",
  "English",
  "Gujarati",
  "Punjabi",
  "Tamil",
  "Telugu",
  "Bengali",
  "Marathi",
  "Kannada",
  "Malayalam",
  "Urdu",
  "Multilingual",
] as const;
