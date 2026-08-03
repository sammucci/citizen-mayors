"use client";

import { SelectField } from "@/components/select-field";

// Unlike VolunteerCategoryField (a combobox that grows as people type),
// this is a plain select from a fixed, admin-curated list — "who it was
// for" is meant to stay small and deliberate, same reasoning as
// categories/tag_groups elsewhere in this app. Optional: plenty of
// volunteer work (Environmental Conservation, say) genuinely isn't "for"
// any particular population, so the blank option is a real, valid choice,
// not just a placeholder. Routed through SelectField rather than a bare
// <select> per this codebase's standing rule (see select-field.tsx).
export function PopulationServedField({
  categories,
  defaultValue,
}: {
  categories: string[];
  defaultValue?: string | null;
}) {
  return (
    <SelectField name="population_served" defaultValue={defaultValue ?? ""}>
      <option value="">Not population-specific / general</option>
      {categories.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </SelectField>
  );
}
