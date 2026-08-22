/**
 * Explicitly verified groups that may legitimately share one corporate mark.
 *
 * Keep this list narrow. A repeated image or similar company name is not enough:
 * membership should be backed by the issuer, manager, or parent group. These IDs
 * let the finalizer distinguish a shared family identity from a provider collision.
 */
export const verifiedLogoFamilies = [
  {
    id: "hlb",
    source: "https://www.hlbgroup.com/",
    members: [
      "KRX:024850",
      "KRX:046210",
      "KRX:067630",
      "KRX:187420",
      "KRX:196300",
    ],
  },
  {
    id: "avic",
    source: "https://www1.hkexnews.hk/listedco/listconews/sehk/2023/0426/2023042600453.pdf",
    members: [
      "SSE:600316",
      "SSE:600523",
      "SSE:600862",
      "SZSE:000768",
      "SZSE:002179",
    ],
  },
  {
    id: "kiwoom",
    source: "https://www.kiwoom.com/",
    members: [
      "KRX:466690",
      "KRX:487720",
      "KRX:489480",
    ],
  },
  {
    id: "pimco",
    source: "https://www.pimco.com/us/en/general/npx-filings",
    members: [
      "NYSE:PCM",
      "NYSE:PCN",
      "NYSE:PFL",
      "NYSE:PFN",
      "NYSE:PHK",
      "NYSE:PML",
      "NYSE:PTY",
      "NYSE:RCS",
    ],
  },
  {
    id: "prudential-pgim",
    source: "https://investor.prudential.com/about-us/default.aspx",
    members: [
      "NYSE:GHY",
      "NYSE:ISD",
      "NYSE:PFH",
      "NYSE:PRH",
      "NYSE:PRS",
      "NYSE:SDHY",
    ],
  },
  {
    id: "gabelli-gamco",
    source: "https://gabelli.com/funds/",
    members: [
      "NYSE:BCV",
      "NYSE:BCV-PA",
      "NYSE:ECF",
      "NYSE:ECF-PA",
      "NYSE:GAB",
      "NYSE:GAB-PG",
      "NYSE:GAB-PH",
      "NYSE:GAB-PK",
      "NYSE:GCV",
      "NYSE:GDV",
      "NYSE:GDV-PH",
      "NYSE:GDV-PK",
      "NYSE:GGN",
      "NYSE:GGN-PB",
      "NYSE:GGT",
      "NYSE:GGT-PE",
      "NYSE:GGT-PG",
      "NYSE:GGZ",
      "NYSE:GLU",
      "NYSE:GLU-PB",
      "NYSE:GNT-PA",
      "NYSE:GRX",
      "NYSE:GUT",
      "NYSE:GUT-PC",
    ],
  },
  {
    id: "franklin-templeton",
    source: "https://www.franklintempleton.com/forms-literature/download/DIST-SUMM",
    members: [
      "NYSE:BWG",
      "NYSE:EMF",
      "NYSE:FGDL",
      "NYSE:FT",
      "NYSE:FTF",
      "NYSE:SCD",
      "NYSE:TDF",
      "NYSE:TEI",
      "NYSE:WDI",
      "NYSE:XRPZ",
    ],
  },
  {
    id: "spdr",
    source: "https://www.ssga.com/us/en/individual/etfs/spdr-gold-minishares-gldm",
    members: [
      "NYSE:DIA",
      "NYSE:GLD",
      "NYSE:GLDM",
      "NYSE:MDY",
      "NYSE:SPY",
    ],
  },
];

export const verifiedLogoFamilyByListing = new Map(
  verifiedLogoFamilies.flatMap((family) => family.members.map((id) => [id, family])),
);
