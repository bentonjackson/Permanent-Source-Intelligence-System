import { SourceRecord } from "@/types/domain";

export interface OfficialSourceDefinition extends SourceRecord {}

const baseLogs = [
  {
    timestamp: new Date().toISOString(),
    level: "info" as const,
    message: "Source registered for database-backed sync coverage."
  }
];

export const officialSourceDefinitions: OfficialSourceDefinition[] = [
  {
    id: "src-cedar-rapids-permit-reports",
    name: "Cedar Rapids Permit Reports",
    slug: "cedar-rapids-permit-reports",
    jurisdiction: "Cedar Rapids",
    county: "Linn",
    city: "Cedar Rapids",
    sourceScope: "city",
    countyRadiusEligible: true,
    countySelectorVisible: true,
    officialSourceType: "official city permit reports",
    connectorType: "document",
    priorityRank: 10,
    sourceType: "public permit reports page",
    parserType: "cedar-rapids-monthly-reports",
    sourceUrl:
      "https://www.cedar-rapids.org/local_government/departments_a_-_f/building_services/building_and_trades/permit_reports.php",
    active: true,
    syncFrequency: "0 6 * * *",
    authRequired: false,
    lastSuccessfulSync: null,
    syncStatus: "idle",
    sourceConfidenceScore: 92,
    sourceFreshnessScore: 84,
    logs: baseLogs
  },
  {
    id: "src-linn-county-planning-agenda",
    name: "Linn County Planning Agenda",
    slug: "linn-county-planning-agenda",
    jurisdiction: "Linn County Planning & Development",
    county: "Linn",
    city: "Cedar Rapids",
    sourceScope: "county",
    countyRadiusEligible: true,
    countySelectorVisible: true,
    officialSourceType: "official county planning agenda",
    connectorType: "gis_planning",
    priorityRank: 50,
    sourceType: "public planning/zoning source",
    parserType: "linn-county-planning-agenda",
    sourceUrl: "https://gis.linncountyiowa.gov/web-data/planning/committee-documentation/agenda.pdf",
    active: true,
    syncFrequency: "0 6 * * *",
    authRequired: false,
    lastSuccessfulSync: null,
    syncStatus: "idle",
    sourceConfidenceScore: 82,
    sourceFreshnessScore: 76,
    logs: baseLogs
  },
  {
    id: "src-tiffin-permit-portal",
    name: "Tiffin Permit Portal",
    slug: "tiffin-permit-portal",
    jurisdiction: "Tiffin",
    county: "Johnson",
    city: "Tiffin",
    sourceScope: "city",
    countyRadiusEligible: true,
    countySelectorVisible: true,
    officialSourceType: "official city permit portal",
    connectorType: "portal",
    priorityRank: 30,
    sourceType: "public permit portal",
    parserType: "tiffin-permit-portal",
    sourceUrl: "https://portal.iworq.net/TIFFIN/permits/600",
    active: true,
    syncFrequency: "0 6 * * *",
    authRequired: false,
    lastSuccessfulSync: null,
    syncStatus: "idle",
    sourceConfidenceScore: 88,
    sourceFreshnessScore: 86,
    logs: baseLogs
  },
  {
    id: "src-johnson-county-current-applications",
    name: "Johnson County Current Applications",
    slug: "johnson-county-current-applications",
    jurisdiction: "Johnson County Planning, Development and Sustainability",
    county: "Johnson",
    city: "Iowa City",
    sourceScope: "county",
    countyRadiusEligible: true,
    countySelectorVisible: true,
    officialSourceType: "official county GIS / development context",
    connectorType: "gis_planning",
    priorityRank: 40,
    sourceType: "public planning/zoning source",
    parserType: "johnson-county-current-applications",
    sourceUrl: "https://www.johnsoncountyiowa.gov/apps",
    active: true,
    syncFrequency: "0 6 * * *",
    authRequired: false,
    lastSuccessfulSync: null,
    syncStatus: "idle",
    sourceConfidenceScore: 84,
    sourceFreshnessScore: 80,
    logs: baseLogs
  },
  {
    id: "src-linn-assessor-building",
    name: "Linn County Assessor Building Data",
    slug: "linn-assessor-building",
    jurisdiction: "Linn County Assessor",
    county: "Linn",
    city: "Cedar Rapids",
    sourceScope: "county",
    countyRadiusEligible: true,
    countySelectorVisible: true,
    officialSourceType: "official county assessor building search",
    connectorType: "search",
    priorityRank: 20,
    sourceType: "public assessor building search",
    parserType: "linn-assessor-building",
    sourceUrl: "https://linn.iowaassessors.com/search/comm/bldg/",
    active: false,
    syncFrequency: "manual",
    authRequired: false,
    lastSuccessfulSync: null,
    syncStatus: "warning",
    sourceConfidenceScore: 72,
    sourceFreshnessScore: 68,
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: "warning",
        message: "Registered as a priority assessor source. Parser activation is staged after the first two production connectors."
      }
    ]
  },
  {
    id: "src-cedar-rapids-assessor-residential",
    name: "Cedar Rapids Residential Assessor Data",
    slug: "cedar-rapids-assessor-residential",
    jurisdiction: "Cedar Rapids City Assessor",
    county: "Linn",
    city: "Cedar Rapids",
    sourceScope: "city",
    countyRadiusEligible: true,
    countySelectorVisible: true,
    officialSourceType: "official residential assessor search",
    connectorType: "search",
    priorityRank: 21,
    sourceType: "public assessor residential search",
    parserType: "cedar-rapids-assessor-residential",
    sourceUrl: "https://cedarrapids.iowaassessors.com/search/res/",
    active: false,
    syncFrequency: "manual",
    authRequired: false,
    lastSuccessfulSync: null,
    syncStatus: "warning",
    sourceConfidenceScore: 70,
    sourceFreshnessScore: 66,
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: "warning",
        message: "Registered as a priority assessor source. Parser activation is staged after the first two production connectors."
      }
    ]
  },
  {
    id: "src-cedar-rapids-building-permit-viewer",
    name: "Cedar Rapids Building Permit Viewer",
    slug: "cedar-rapids-building-permit-viewer",
    jurisdiction: "Cedar Rapids Building Services",
    county: "Linn",
    city: "Cedar Rapids",
    sourceScope: "city",
    countyRadiusEligible: true,
    countySelectorVisible: true,
    officialSourceType: "official city permit viewer",
    connectorType: "search",
    priorityRank: 11,
    sourceType: "public permit viewer",
    parserType: "cedar-rapids-building-permit-viewer",
    sourceUrl: "https://apps2.cedar-rapids.org/BuildingPermitViewer/",
    active: false,
    syncFrequency: "manual",
    authRequired: false,
    lastSuccessfulSync: null,
    syncStatus: "warning",
    sourceConfidenceScore: 84,
    sourceFreshnessScore: 72,
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: "warning",
        message: "Primary Cedar Rapids search source registered. Parser activation is staged behind the current report connector."
      }
    ]
  },
  ...[
    {
      id: "src-cedar-falls-energov",
      name: "Cedar Falls EnerGov Search",
      slug: "cedar-falls-energov",
      jurisdiction: "Cedar Falls",
      county: "Black Hawk",
      city: "Cedar Falls",
      sourceScope: "city" as const,
      officialSourceType: "official city permit self-service portal",
      connectorType: "portal" as const,
      priorityRank: 32,
      sourceType: "public permit portal",
      parserType: "cedar-falls-energov",
      sourceUrl: "https://cedarfallsia-energovweb.tylerhost.net/apps/selfservice#/search"
    },
    {
      id: "src-waterloo-energov",
      name: "Waterloo EnerGov Search",
      slug: "waterloo-energov",
      jurisdiction: "Waterloo",
      county: "Black Hawk",
      city: "Waterloo",
      sourceScope: "city" as const,
      officialSourceType: "official city permit self-service portal",
      connectorType: "portal" as const,
      priorityRank: 33,
      sourceType: "public permit portal",
      parserType: "waterloo-energov",
      sourceUrl: "https://selfservice.waterloo-ia.org/EnerGov_Prod/SelfService#/search"
    }
  ].map((source) => ({
    ...source,
    countyRadiusEligible: true,
    countySelectorVisible: true,
    active: false,
    syncFrequency: "manual",
    authRequired: false,
    lastSuccessfulSync: null,
    syncStatus: "warning" as const,
    sourceConfidenceScore: 80,
    sourceFreshnessScore: 68,
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: "warning" as const,
        message: "High-signal municipal portal registered for corridor expansion. Connector activation is staged."
      }
    ]
  })),
  ...[
    ["Johnson County Assessor", "johnson-assessor", "Johnson", "Iowa City", "https://johnson.iowaassessors.com"],
    ["Black Hawk County Assessor", "black-hawk-assessor", "Black Hawk", "Waterloo", "https://blackhawk.iowaassessors.com"],
    ["Benton County Assessor", "benton-assessor", "Benton", "Vinton", "https://benton.iowaassessors.com"],
    ["Buchanan County Assessor", "buchanan-assessor", "Buchanan", "Independence", "https://buchanan.iowaassessors.com"]
  ].map(([name, slug, county, city, sourceUrl], index) => ({
    id: `src-${slug}`,
    name,
    slug,
    jurisdiction: name,
    county,
    city,
    sourceScope: "county" as const,
    countyRadiusEligible: true,
    countySelectorVisible: true,
    officialSourceType: "official county assessor search",
    connectorType: "search" as const,
    priorityRank: 22 + index,
    sourceType: "public assessor property search",
    parserType: slug,
    sourceUrl,
    active: false,
    syncFrequency: "manual",
    authRequired: false,
    lastSuccessfulSync: null,
    syncStatus: "warning" as const,
    sourceConfidenceScore: 70,
    sourceFreshnessScore: 62,
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: "warning" as const,
        message: "Supplemental assessor enrichment source registered for parcel, ownership, and value context."
      }
    ]
  })),
  ...[
    [
      "Linn County Building Permits & Inspections",
      "linn-county-building-permits",
      "Linn",
      "Cedar Rapids",
      "https://www.linncountyiowa.gov/1496/Building-Permits-Inspections"
    ],
    [
      "Black Hawk County Online Permit Forms",
      "black-hawk-online-permit-forms",
      "Black Hawk",
      "Waterloo",
      "https://www.blackhawkcounty.iowa.gov/232/Online-Permit-Forms"
    ],
    [
      "Benton County Applications and Permits",
      "benton-county-applications-permits",
      "Benton",
      "Vinton",
      "https://www.bentoncountyia.gov/board_of_supervisors/applications_and_permits"
    ]
  ].map(([name, slug, county, city, sourceUrl], index) => ({
    id: `src-${slug}`,
    name,
    slug,
    jurisdiction: name,
    county,
    city,
    sourceScope: "county" as const,
    countyRadiusEligible: true,
    countySelectorVisible: true,
    officialSourceType: "official county permit or application page",
    connectorType: "document" as const,
    priorityRank: 44 + index,
    sourceType: "public permit or application page",
    parserType: slug,
    sourceUrl,
    active: false,
    syncFrequency: "manual",
    authRequired: false,
    lastSuccessfulSync: null,
    syncStatus: "warning" as const,
    sourceConfidenceScore: 68,
    sourceFreshnessScore: 58,
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: "warning" as const,
        message: "County permit support source registered for connector expansion and review coverage."
      }
    ]
  })),
  ...[
    [
      "Cedar Rapids Development Services",
      "cedar-rapids-development-services",
      "Linn",
      "Cedar Rapids",
      "https://www.cedar-rapids.org/local_government/departments_a_-_f/development_services"
    ],
    [
      "Cedar Rapids Community Development",
      "cedar-rapids-community-development",
      "Linn",
      "Cedar Rapids",
      "https://www.cedar-rapids.org/local_government/departments_a_-_f/community_development"
    ],
    [
      "Johnson County Planning and Zoning",
      "johnson-county-planning-zoning",
      "Johnson",
      "Iowa City",
      "https://www.johnsoncountyiowa.gov/planning-and-zoning"
    ],
    [
      "Linn County Planning & Development",
      "linn-county-planning-development",
      "Linn",
      "Cedar Rapids",
      "https://www.linncountyiowa.gov/1510/Planning-Development"
    ],
    [
      "Black Hawk County Planning & Zoning",
      "black-hawk-planning-zoning",
      "Black Hawk",
      "Waterloo",
      "https://www.blackhawkcounty.iowa.gov/149/Planning-Zoning"
    ],
    [
      "Buchanan County Planning & Zoning",
      "buchanan-county-planning-zoning",
      "Buchanan",
      "Independence",
      "https://www.buchanancounty.iowa.gov/departments/planning_zoning/index.php"
    ],
    [
      "Johnson County GIS Interactive Maps",
      "johnson-county-gis-maps",
      "Johnson",
      "Iowa City",
      "https://www.johnsoncountyiowa.gov/gis/interactive-maps"
    ],
    [
      "Black Hawk County Real Estate Mapping",
      "black-hawk-real-estate-mapping",
      "Black Hawk",
      "Waterloo",
      "https://www.blackhawkcounty.iowa.gov/377/Real-Estate-Mapping"
    ],
    [
      "Cedar Rapids ArcGIS",
      "cedar-rapids-arcgis",
      "Linn",
      "Cedar Rapids",
      "https://cedar-rapids.maps.arcgis.com"
    ]
  ].map(([name, slug, county, city, sourceUrl], index) => ({
    id: `src-${slug}`,
    name,
    slug,
    jurisdiction: name,
    county,
    city,
    sourceScope: "supplemental" as const,
    countyRadiusEligible: true,
    countySelectorVisible: true,
    officialSourceType: "official development or GIS signal source",
    connectorType: "gis_planning" as const,
    priorityRank: 70 + index,
    sourceType: "public planning, development, or GIS source",
    parserType: slug,
    sourceUrl,
    active: false,
    syncFrequency: "manual",
    authRequired: false,
    lastSuccessfulSync: null,
    syncStatus: "warning" as const,
    sourceConfidenceScore: 64,
    sourceFreshnessScore: 54,
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: "warning" as const,
        message: "Supplemental development signal source registered for earlier parcel, zoning, and subdivision discovery."
      }
    ]
  })),
  ...[
    ["Benton", "Vinton"],
    ["Buchanan", "Independence"],
    ["Black Hawk", "Waterloo"]
  ].map(([county, city], index) => ({
    id: `src-${county.toLowerCase().replace(/\s+/g, "-")}-placeholder-${index}`,
    name: `${county} County Coverage Placeholder`,
    slug: `${county.toLowerCase().replace(/\s+/g, "-")}-coverage-placeholder`,
    jurisdiction: `${county} County`,
    county,
    city,
    sourceScope: "county" as const,
    countyRadiusEligible: true,
    countySelectorVisible: true,
    officialSourceType: "official source pending connector activation",
    connectorType: "search" as const,
    priorityRank: 60 + index,
    sourceType: "public permit or assessor source",
    parserType: "manual-xlsx",
    sourceUrl: `https://${county.toLowerCase().replace(/\s+/g, "")}countyia.gov`,
    active: false,
    syncFrequency: "manual",
    authRequired: false,
    lastSuccessfulSync: null,
    syncStatus: "warning" as const,
    sourceConfidenceScore: 50,
    sourceFreshnessScore: 30,
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: "warning" as const,
        message: "County is in the seeded corridor, but a live connector is not activated yet."
      }
    ]
  }))
];

export function getOfficialSourceDefinition(sourceId: string) {
  return officialSourceDefinitions.find((source) => source.id === sourceId) ?? null;
}
