const cedarRapidsAnchor = { lat: 41.9779, lng: -91.6656 };

export const COUNTIES_NEAR_ME_LABEL = "Counties near me";

export const cedarRapids75MileCounties = [
  "Linn",
  "Johnson",
  "Benton",
  "Buchanan",
  "Black Hawk",
  "Jones",
  "Iowa",
  "Cedar",
  "Tama",
  "Delaware",
  "Washington"
] as const;

export const coreServiceCounties = ["Linn", "Johnson", "Benton", "Buchanan", "Black Hawk"] as const;

export interface TerritoryDefinition {
  id: string;
  name: string;
  type: "corridor" | "county_bundle" | "radius" | "city_bundle";
  counties: string[];
  cities: string[];
  radiusMiles?: number;
}

export const seededTerritories: TerritoryDefinition[] = [
  {
    id: "territory-cedar-rapids-metro",
    name: "Cedar Rapids Metro",
    type: "city_bundle",
    counties: ["Linn"],
    cities: ["Cedar Rapids", "Marion", "Hiawatha"]
  },
  {
    id: "territory-iowa-city-coralville",
    name: "Iowa City / Coralville Area",
    type: "city_bundle",
    counties: ["Johnson"],
    cities: ["Iowa City", "Coralville", "North Liberty"]
  },
  {
    id: "territory-corridor-north",
    name: "Cedar Rapids to Waterloo Corridor",
    type: "corridor",
    counties: ["Linn", "Benton", "Black Hawk"],
    cities: ["Cedar Rapids", "Vinton", "Waterloo", "Cedar Falls"]
  },
  {
    id: "territory-radius-75",
    name: "75 Mile Radius from Cedar Rapids",
    type: "radius",
    counties: [...cedarRapids75MileCounties],
    cities: [],
    radiusMiles: 75
  }
];

export function isPreferredCorridorCounty(county: string) {
  return coreServiceCounties.includes(county as (typeof coreServiceCounties)[number]);
}

export function isSeventyFiveMileCounty(county: string) {
  return cedarRapids75MileCounties.includes(county as (typeof cedarRapids75MileCounties)[number]);
}

export function getCountySelectorOptions() {
  return [COUNTIES_NEAR_ME_LABEL, ...cedarRapids75MileCounties];
}

export function corridorBoostForCounty(county: string) {
  if (isPreferredCorridorCounty(county)) {
    return 10;
  }

  if (isSeventyFiveMileCounty(county)) {
    return 4;
  }

  return -8;
}

export function getCedarRapidsAnchor() {
  return cedarRapidsAnchor;
}
