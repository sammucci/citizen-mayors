// Real Philadelphia population by council district, sourced from the
// Census Bureau's 2020-2024 5-year American Community Survey (ACS5) —
// NOT an estimate or guess. Refreshed in v60 from the prior 2022 ACS5
// vintage (Census Bureau released 2020-2024 on January 29, 2026).
//
// Built the same way as the original 2022 pull: every one of
// Philadelphia's 408 census tracts (2020 tract boundaries, pulled from
// TIGERweb) was matched to a council district by checking the tract's
// centroid point (simple average of its boundary vertices — plenty
// precise for a tract-sized area) against the 10 district polygons
// (Council_Districts_2024.geojson). Each tract's ACS values were then
// summed into whichever district contained its centroid. All 408
// tracts had a centroid falling inside a district polygon or close
// enough to snap to the nearest one (only 2 needed that nearest-match
// fallback, both slivers along a district boundary from simplified
// polygon edges) — no tracts were dropped this time, unlike the 391-of-
// however-many-total figure from the 2022 pull's methodology note.
// City-wide total across all 10 districts: 1,579,706 — in line with
// Philadelphia's actual population, a sanity check that the join
// worked.
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
  age: { label: string; count: number }[];
};

// Age brackets pulled separately from ACS5 table B01001 ("Sex by Age"),
// summed male+female per bracket, then combined into the same seven
// brackets residents can choose from on their own profile (18-24
// through 65+, plus Under 18 — added in the same version "Under 18"
// became a real profile option). Under 18 = B01001_003E through 006E
// (male, ages 0-17) + 027E through 030E (female, ages 0-17), same
// tract-centroid-to-district join described above, just a second pull
// against the same table for the four additional variables on each
// side.

export const CENSUS_DISTRICT_DEMOGRAPHICS: Record<number, DistrictCensusStats> = {
  1: {
    totalPopulation: 168131,
    race: [
      { label: "White", count: 99793 },
      { label: "Black or African American", count: 13905 },
      { label: "Asian", count: 21303 },
      { label: "Hispanic or Latino", count: 21878 },
      { label: "Other", count: 168131 - 99793 - 13905 - 21303 - 21878 },
    ],
    gender: [
      { label: "Male", count: 82937 },
      { label: "Female", count: 85194 },
    ],
    housing: [
      { label: "Homeowner", count: 42351 },
      { label: "Renter", count: 40655 },
    ],
    age: [
      { label: "Under 18", count: 23097 },
      { label: "18-24", count: 10546 },
      { label: "25-34", count: 40161 },
      { label: "35-44", count: 27474 },
      { label: "45-54", count: 16507 },
      { label: "55-64", count: 14658 },
      { label: "65+", count: 20257 },
    ],
  },
  2: {
    totalPopulation: 145698,
    race: [
      { label: "White", count: 59669 },
      { label: "Black or African American", count: 54228 },
      { label: "Asian", count: 14467 },
      { label: "Hispanic or Latino", count: 10013 },
      { label: "Other", count: 145698 - 59669 - 54228 - 14467 - 10013 },
    ],
    gender: [
      { label: "Male", count: 68463 },
      { label: "Female", count: 77235 },
    ],
    housing: [
      { label: "Homeowner", count: 33670 },
      { label: "Renter", count: 36313 },
    ],
    age: [
      { label: "Under 18", count: 28625 },
      { label: "18-24", count: 12021 },
      { label: "25-34", count: 38881 },
      { label: "35-44", count: 23780 },
      { label: "45-54", count: 16668 },
      { label: "55-64", count: 17319 },
      { label: "65+", count: 19588 },
    ],
  },
  3: {
    totalPopulation: 151294,
    race: [
      { label: "White", count: 32072 },
      { label: "Black or African American", count: 91970 },
      { label: "Asian", count: 11121 },
      { label: "Hispanic or Latino", count: 6706 },
      { label: "Other", count: 151294 - 32072 - 91970 - 11121 - 6706 },
    ],
    gender: [
      { label: "Male", count: 69183 },
      { label: "Female", count: 82111 },
    ],
    housing: [
      { label: "Homeowner", count: 22801 },
      { label: "Renter", count: 41421 },
    ],
    age: [
      { label: "Under 18", count: 26803 },
      { label: "18-24", count: 31252 },
      { label: "25-34", count: 29746 },
      { label: "35-44", count: 15691 },
      { label: "45-54", count: 13434 },
      { label: "55-64", count: 12415 },
      { label: "65+", count: 16419 },
    ],
  },
  4: {
    totalPopulation: 156280,
    race: [
      { label: "White", count: 48127 },
      { label: "Black or African American", count: 90235 },
      { label: "Asian", count: 3929 },
      { label: "Hispanic or Latino", count: 7679 },
      { label: "Other", count: 156280 - 48127 - 90235 - 3929 - 7679 },
    ],
    gender: [
      { label: "Male", count: 72479 },
      { label: "Female", count: 83801 },
    ],
    housing: [
      { label: "Homeowner", count: 35689 },
      { label: "Renter", count: 35898 },
    ],
    age: [
      { label: "Under 18", count: 29804 },
      { label: "18-24", count: 16120 },
      { label: "25-34", count: 33591 },
      { label: "35-44", count: 20443 },
      { label: "45-54", count: 15306 },
      { label: "55-64", count: 17155 },
      { label: "65+", count: 23693 },
    ],
  },
  5: {
    totalPopulation: 158091,
    race: [
      { label: "White", count: 52258 },
      { label: "Black or African American", count: 66613 },
      { label: "Asian", count: 10396 },
      { label: "Hispanic or Latino", count: 22075 },
      { label: "Other", count: 158091 - 52258 - 66613 - 10396 - 22075 },
    ],
    gender: [
      { label: "Male", count: 72790 },
      { label: "Female", count: 85301 },
    ],
    housing: [
      { label: "Homeowner", count: 27684 },
      { label: "Renter", count: 47105 },
    ],
    age: [
      { label: "Under 18", count: 28870 },
      { label: "18-24", count: 24736 },
      { label: "25-34", count: 36608 },
      { label: "35-44", count: 20191 },
      { label: "45-54", count: 14246 },
      { label: "55-64", count: 17784 },
      { label: "65+", count: 21596 },
    ],
  },
  6: {
    totalPopulation: 146475,
    race: [
      { label: "White", count: 66028 },
      { label: "Black or African American", count: 23272 },
      { label: "Asian", count: 14384 },
      { label: "Hispanic or Latino", count: 32849 },
      { label: "Other", count: 146475 - 66028 - 23272 - 14384 - 32849 },
    ],
    gender: [
      { label: "Male", count: 71804 },
      { label: "Female", count: 74671 },
    ],
    housing: [
      { label: "Homeowner", count: 35953 },
      { label: "Renter", count: 21005 },
    ],
    age: [
      { label: "Under 18", count: 35646 },
      { label: "18-24", count: 10251 },
      { label: "25-34", count: 21698 },
      { label: "35-44", count: 20983 },
      { label: "45-54", count: 16466 },
      { label: "55-64", count: 19434 },
      { label: "65+", count: 22026 },
    ],
  },
  7: {
    totalPopulation: 159748,
    race: [
      { label: "White", count: 21795 },
      { label: "Black or African American", count: 40129 },
      { label: "Asian", count: 8890 },
      { label: "Hispanic or Latino", count: 84071 },
      { label: "Other", count: 159748 - 21795 - 40129 - 8890 - 84071 },
    ],
    gender: [
      { label: "Male", count: 78045 },
      { label: "Female", count: 81703 },
    ],
    housing: [
      { label: "Homeowner", count: 33145 },
      { label: "Renter", count: 24280 },
    ],
    age: [
      { label: "Under 18", count: 46124 },
      { label: "18-24", count: 14003 },
      { label: "25-34", count: 24827 },
      { label: "35-44", count: 20820 },
      { label: "45-54", count: 20988 },
      { label: "55-64", count: 19147 },
      { label: "65+", count: 14632 },
    ],
  },
  8: {
    totalPopulation: 159357,
    race: [
      { label: "White", count: 28212 },
      { label: "Black or African American", count: 108196 },
      { label: "Asian", count: 2863 },
      { label: "Hispanic or Latino", count: 12921 },
      { label: "Other", count: 159357 - 28212 - 108196 - 2863 - 12921 },
    ],
    gender: [
      { label: "Male", count: 72286 },
      { label: "Female", count: 87071 },
    ],
    housing: [
      { label: "Homeowner", count: 35758 },
      { label: "Renter", count: 34081 },
    ],
    age: [
      { label: "Under 18", count: 36288 },
      { label: "18-24", count: 14015 },
      { label: "25-34", count: 22423 },
      { label: "35-44", count: 19833 },
      { label: "45-54", count: 17790 },
      { label: "55-64", count: 21723 },
      { label: "65+", count: 28274 },
    ],
  },
  9: {
    totalPopulation: 172424,
    race: [
      { label: "White", count: 17029 },
      { label: "Black or African American", count: 100223 },
      { label: "Asian", count: 14730 },
      { label: "Hispanic or Latino", count: 31706 },
      { label: "Other", count: 172424 - 17029 - 100223 - 14730 - 31706 },
    ],
    gender: [
      { label: "Male", count: 79878 },
      { label: "Female", count: 92546 },
    ],
    housing: [
      { label: "Homeowner", count: 43981 },
      { label: "Renter", count: 22701 },
    ],
    age: [
      { label: "Under 18", count: 43451 },
      { label: "18-24", count: 13131 },
      { label: "25-34", count: 24788 },
      { label: "35-44", count: 21776 },
      { label: "45-54", count: 21046 },
      { label: "55-64", count: 20932 },
      { label: "65+", count: 26921 },
    ],
  },
  10: {
    totalPopulation: 162208,
    race: [
      { label: "White", count: 99402 },
      { label: "Black or African American", count: 16762 },
      { label: "Asian", count: 22838 },
      { label: "Hispanic or Latino", count: 15984 },
      { label: "Other", count: 162208 - 99402 - 16762 - 22838 - 15984 },
    ],
    gender: [
      { label: "Male", count: 79521 },
      { label: "Female", count: 82687 },
    ],
    housing: [
      { label: "Homeowner", count: 40873 },
      { label: "Renter", count: 24064 },
    ],
    age: [
      { label: "Under 18", count: 36091 },
      { label: "18-24", count: 8666 },
      { label: "25-34", count: 22846 },
      { label: "35-44", count: 21094 },
      { label: "45-54", count: 19451 },
      { label: "55-64", count: 21717 },
      { label: "65+", count: 33723 },
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
    age: sum((d) => d.age),
  };
}
