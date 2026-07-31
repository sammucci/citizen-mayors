// The real, current list of Philadelphia City Council standing committees
// (phlcouncil.com/standing-committees, checked against the 2024-2027 term
// rules). A fixed list instead of free text specifically because
// committee names contain their own commas ("Parks, Recreation and
// Cultural Affairs"), which broke the old comma-separated-string
// approach — no way to tell "two committees" from "one committee whose
// name has a comma in it." Plain module (no "use client") so both the
// client-side editor and any future server-side rendering can import the
// same source of truth without an RSC boundary issue.
export const COUNCIL_COMMITTEES = [
  "Appropriations",
  "Children and Youth",
  "Commerce and Economic Development",
  "Education",
  "Environment",
  "Ethics",
  "Finance",
  "Fiscal Stability and Intergovernmental Cooperation",
  "Global Opportunities and the Creative/Innovative Economy",
  "Housing, Neighborhood Development and the Homeless",
  "Intergenerational Affairs and Aging",
  "Labor and Civil Service",
  "Law and Government",
  "Legislative Oversight",
  "Licenses and Inspections",
  "Neighborhood Services",
  "People With Disabilities and Special Needs",
  "Public Health and Human Services",
  "Public Property and Public Works",
  "Public Safety",
  "Rules",
  "Streets and Services",
  "Technology and Information Services",
  "Transportation and Public Utilities",
  "Whole Council",
] as const;
