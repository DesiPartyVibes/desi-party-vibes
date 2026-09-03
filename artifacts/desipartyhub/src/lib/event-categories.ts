// Shared category list for the Events feature. Not backed by a database
// table (unlike vendor categories) - events are moderated one at a time by
// an admin, so a small fixed list picked from a dropdown is enough to keep
// tagging consistent without the overhead of a managed taxonomy.
export const EVENT_CATEGORIES = [
  "Cultural Festival",
  "Community Gathering",
  "Concert / Performance",
  "Religious / Temple Event",
  "Vendor Showcase",
  "Other",
] as const;
