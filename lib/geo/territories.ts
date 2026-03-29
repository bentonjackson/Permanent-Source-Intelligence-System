const cedarRapidsAnchor = { lat: 41.9779, lng: -91.6656 };

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
    id: "territory-radius-60",
    name: "60 Mile Radius from Cedar Rapids",
    type: "radius",
    counties: ["Linn", "Johnson", "Benton", "Buchanan", "Black Hawk"],
    cities: [],
    radiusMiles: 60
  }
];

export function isPreferredCorridorCounty(county: string) {
  return ["Linn", "Johnson", "Benton", "Buchanan", "Black Hawk"].includes(county);
}

export function corridorBoostForCounty(county: string) {
  return isPreferredCorridorCounty(county) ? 10 : -8;
}

export function getCedarRapidsAnchor() {
  return cedarRapidsAnchor;
}
