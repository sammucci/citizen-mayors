// Real Philadelphia population by council district, sourced from the
// Census Bureau's 2022 5-year American Community Survey (ACS5) — NOT an
// estimate or guess. Built the same way as the zip/district crosswalk:
// every one of the city's 391 populated census tracts (2020 tract
// boundaries) was matched to a council district by checking the tract's
// internal centroid point against the district polygons Samantha
// uploaded (Council_Districts_2024.geojson), then each tract's ACS
// values were summed up into its district. A handful of unpopulated
// tracts (airport, parks, river) were excluded — they don't map cleanly
// to a district and have ~0 population anyway.
//
// Race/ethnicity categories mirror the Census's own non-Hispanic-race +
// separate-Hispanic-any-race convention (B03002), not a perfect 1:1 with
// the profile form's options — "Other" below covers American Indian/
// Alaska Native, Native Hawaiian/Pacific Islander, "some other race,"
// and multiracial residents grouped together, since ACS reports those
// as several small separate categories rather than one "Other."
// Non-binary isn't a category the Census collects, so "Gender" here is
// necessarily just male/female — flagged as a real limitation, not
// glossed over.
//
// This is meant to sit ALONGSIDE the self-reported member breakdown
// above it, not replace it — a rough comparison of "does who's showing
// up look like Philadelphia," not a claim that either number is more
// "correct."
export type DistrictCensusStats = {
  totalPopulation: number;
  race: { label: string; count: number }[];
  gender: { label: string; count: number }[];
  housing: { label: string; count: number }[];
};

export const CENSUS_DISTRICT_DEMOGRAPHICS: Record<number, DistrictCensusStats> = {
  1: {
    totalPopulation: 152429,
    race: [
      { label: "White", count: 94997 },
      { label: "Black or African American", count: 9973 },
      { label: "Asian", count: 20129 },
      { label: "Hispanic or Latino", count: 19829 },
      { label: "Other", count: 152429 - 94997 - 9973 - 20129 - 19829 },
    ],
    gender: [
      { label: "Male", count: 76714 },
      { label: "Female", count: 75715 },
    ],
    housing: [
      { label: "Homeowner", count: 38421 },
      { label: "Renter", count: 34172 },
    ],
  },
  2: {
    totalPopulation: 150053,
    race: [
      { label: "White", count: 62145 },
      { label: "Black or African American", count: 57982 },
      { label: "Asian", count: 13531 },
      { label: "Hispanic or Latino", count: 9672 },
      { label: "Other", count: 150053 - 62145 - 57982 - 13531 - 9672 },
    ],
    gender: [
      { label: "Male", count: 70466 },
      { label: "Female", count: 79587 },
    ],
    housing: [
      { label: "Homeowner", count: 34226 },
      { label: "Renter", count: 35491 },
    ],
  },
  3: {
    totalPopulation: 155415,
    race: [
      { label: "White", count: 30711 },
      { label: "Black or African American", count: 97889 },
      { label: "Asian", count: 11449 },
      { label: "Hispanic or Latino", count: 6711 },
      { label: "Other", count: 155415 - 30711 - 97889 - 11449 - 6711 },
    ],
    gender: [
      { label: "Male", count: 71836 },
      { label: "Female", count: 83579 },
    ],
    housing: [
      { label: "Homeowner", count: 22564 },
      { label: "Renter", count: 39167 },
    ],
  },
  4: {
    totalPopulation: 157026,
    race: [
      { label: "White", count: 49091 },
      { label: "Black or African American", count: 91344 },
      { label: "Asian", count: 3966 },
      { label: "Hispanic or Latino", count: 6916 },
      { label: "Other", count: 157026 - 49091 - 91344 - 3966 - 6916 },
    ],
    gender: [
      { label: "Male", count: 73541 },
      { label: "Female", count: 83485 },
    ],
    housing: [
      { label: "Homeowner", count: 35600 },
      { label: "Renter", count: 33643 },
    ],
  },
  5: {
    totalPopulation: 155128,
    race: [
      { label: "White", count: 49909 },
      { label: "Black or African American", count: 68908 },
      { label: "Asian", count: 9218 },
      { label: "Hispanic or Latino", count: 21676 },
      { label: "Other", count: 155128 - 49909 - 68908 - 9218 - 21676 },
    ],
    gender: [
      { label: "Male", count: 71815 },
      { label: "Female", count: 83313 },
    ],
    housing: [
      { label: "Homeowner", count: 26156 },
      { label: "Renter", count: 43911 },
    ],
  },
  6: {
    totalPopulation: 150142,
    race: [
      { label: "White", count: 76409 },
      { label: "Black or African American", count: 18522 },
      { label: "Asian", count: 14534 },
      { label: "Hispanic or Latino", count: 32740 },
      { label: "Other", count: 150142 - 76409 - 18522 - 14534 - 32740 },
    ],
    gender: [
      { label: "Male", count: 72858 },
      { label: "Female", count: 77284 },
    ],
    housing: [
      { label: "Homeowner", count: 36829 },
      { label: "Renter", count: 20997 },
    ],
  },
  7: {
    totalPopulation: 174407,
    race: [
      { label: "White", count: 23926 },
      { label: "Black or African American", count: 42885 },
      { label: "Asian", count: 8330 },
      { label: "Hispanic or Latino", count: 94441 },
      { label: "Other", count: 174407 - 23926 - 42885 - 8330 - 94441 },
    ],
    gender: [
      { label: "Male", count: 86576 },
      { label: "Female", count: 87831 },
    ],
    housing: [
      { label: "Homeowner", count: 34097 },
      { label: "Renter", count: 26113 },
    ],
  },
  8: {
    totalPopulation: 158970,
    race: [
      { label: "White", count: 25930 },
      { label: "Black or African American", count: 112353 },
      { label: "Asian", count: 3442 },
      { label: "Hispanic or Latino", count: 10498 },
      { label: "Other", count: 158970 - 25930 - 112353 - 3442 - 10498 },
    ],
    gender: [
      { label: "Male", count: 72279 },
      { label: "Female", count: 86691 },
    ],
    housing: [
      { label: "Homeowner", count: 34760 },
      { label: "Renter", count: 33132 },
    ],
  },
  9: {
    totalPopulation: 176054,
    race: [
      { label: "White", count: 18126 },
      { label: "Black or African American", count: 103586 },
      { label: "Asian", count: 13391 },
      { label: "Hispanic or Latino", count: 32592 },
      { label: "Other", count: 176054 - 18126 - 103586 - 13391 - 32592 },
    ],
    gender: [
      { label: "Male", count: 81162 },
      { label: "Female", count: 94892 },
    ],
    housing: [
      { label: "Homeowner", count: 41465 },
      { label: "Renter", count: 23146 },
    ],
  },
  10: {
    totalPopulation: 163584,
    race: [
      { label: "White", count: 103047 },
      { label: "Black or African American", count: 17173 },
      { label: "Asian", count: 22118 },
      { label: "Hispanic or Latino", count: 14648 },
      { label: "Other", count: 163584 - 103047 - 17173 - 22118 - 14648 },
    ],
    gender: [
      { label: "Male", count: 79836 },
      { label: "Female", count: 83748 },
    ],
    housing: [
      { label: "Homeowner", count: 40031 },
      { label: "Renter", count: 25208 },
    ],
  },
};

export function citywideCensusStats(): DistrictCensusStats {
  const all = Object.values(CENSUS_DISTRICT_DEMOGRAPHICS);
  const sum = (getter: (d: DistrictCensusStats) => { label: string; count: number }[]) => {
    const totals = new Map<string, number>();
    for (const d of all) {
      for (const item of getter(d)) {
        totals.set(item.label, (totals.get(item.label) ?? 0) + item.count);
      }
    }
    return [...totals.entries()].map(([label, count]) => ({ label, count }));
  };
  return {
    totalPopulation: all.reduce((s, d) => s + d.totalPopulation, 0),
    race: sum((d) => d.race),
    gender: sum((d) => d.gender),
    housing: sum((d) => d.housing),
  };
}
