import type { LogoTreatment } from "@/components/orb";

export type Listing = {
  symbol: string;
  company: string;
  exchange: string;
  logoDomain: string;
  logoTreatment?: LogoTreatment;
  logoScale?: number;
  logoOffsetY?: number;
};

/** Reference companies and presentation geometry. Brand colours are generated
 * from current local artwork and exact brand metadata before builds. */
export const listings: Listing[] = [
  { symbol: "ADVANTEST", company: "Advantest", exchange: "TSE", logoDomain: "advantest.com", logoTreatment: "light", logoScale: 0.56 },
  { symbol: "BABA-HK", company: "Alibaba Group", exchange: "HKEX", logoDomain: "alibabagroup.com", logoTreatment: "light", logoScale: 0.58 },
  { symbol: "BYD", company: "BYD Co H", exchange: "HKEX", logoDomain: "bydglobal.com", logoTreatment: "light", logoScale: 0.58 },
  { symbol: "DOOSANENERB", company: "Doosan Enerbility", exchange: "KRX", logoDomain: "doosanenerbility.com", logoTreatment: "light", logoScale: 0.58 },
  { symbol: "ECOPROBM", company: "Ecopro BM", exchange: "KRX", logoDomain: "ecoprobm.co.kr", logoTreatment: "light", logoScale: 0.54 },
  { symbol: "FUJIKURA", company: "Fujikura", exchange: "TSE", logoDomain: "fujikura.co.jp", logoTreatment: "light", logoScale: 0.58 },
  { symbol: "HANMI", company: "Hanmi Semiconductor", exchange: "KRX", logoDomain: "hanmisemi.com", logoTreatment: "light", logoScale: 0.56 },
  { symbol: "HANWHAAERO", company: "Hanwha Aerospace", exchange: "KRX", logoDomain: "hanwhaaerospace.com", logoTreatment: "light", logoScale: 0.56 },
  { symbol: "HANWHAOCEAN", company: "Hanwha Ocean", exchange: "KRX", logoDomain: "hanwhaocean.com", logoTreatment: "light", logoScale: 0.58 },
  { symbol: "HANWHASYS", company: "Hanwha Systems", exchange: "KRX", logoDomain: "hanwhasystems.com", logoTreatment: "light", logoScale: 0.56 },
  { symbol: "HDHYUNDAIELEC", company: "HD Hyundai Electric", exchange: "KRX", logoDomain: "hyundai-electric.com", logoTreatment: "light", logoScale: 0.55 },
  { symbol: "HDKSOE", company: "HD Korea Shipbuilding", exchange: "KRX", logoDomain: "hd-ksoe.com", logoTreatment: "light", logoScale: 0.55 },
  { symbol: "HMM", company: "HMM", exchange: "KRX", logoDomain: "hmm21.com", logoTreatment: "light", logoScale: 0.59 },
  { symbol: "HYUNDAI", company: "Hyundai Motor", exchange: "KRX", logoDomain: "hyundai.com", logoTreatment: "light", logoScale: 0.58 },
  { symbol: "IBIDEN", company: "Ibiden", exchange: "TSE", logoDomain: "ibiden.com", logoTreatment: "light", logoScale: 0.54 },
  { symbol: "ITOCHU", company: "Itochu Corp", exchange: "TSE", logoDomain: "itochu.co.jp", logoTreatment: "light", logoScale: 0.55 },
  { symbol: "KAI", company: "Korea Aerospace Industries", exchange: "KRX", logoDomain: "koreaaero.com", logoTreatment: "light", logoScale: 0.58 },
  { symbol: "KIOXIA", company: "Kioxia Holdings", exchange: "TSE", logoDomain: "kioxia-holdings.com", logoTreatment: "light", logoScale: 0.55 },
  { symbol: "LGES", company: "LG Energy Solution", exchange: "KRX", logoDomain: "lgensol.com", logoTreatment: "light", logoScale: 0.55 },
  { symbol: "MEITUAN", company: "Meituan", exchange: "HKEX", logoDomain: "meituan.com", logoTreatment: "dark", logoScale: 0.58 },
  { symbol: "META", company: "Meta Platforms", exchange: "NASDAQ", logoDomain: "meta.com", logoTreatment: "light", logoScale: 0.6 },
  { symbol: "MICRON", company: "Micron Technology", exchange: "NASDAQ", logoDomain: "micron.com", logoTreatment: "light", logoScale: 0.6 },
  { symbol: "MINIMAX", company: "MiniMax", exchange: "HKEX", logoDomain: "minimaxi.com", logoTreatment: "light", logoScale: 0.56 },
  { symbol: "MSFT", company: "Microsoft", exchange: "NASDAQ", logoDomain: "microsoft.com", logoTreatment: "original", logoScale: 0.54 },
  { symbol: "MSTR", company: "MicroStrategy", exchange: "NASDAQ", logoDomain: "strategy.com", logoTreatment: "light", logoScale: 0.55 },
  { symbol: "NINTENDO", company: "Nintendo", exchange: "TSE", logoDomain: "nintendo.com", logoTreatment: "light", logoScale: 0.62 },
  { symbol: "NVDA", company: "Nvidia", exchange: "NASDAQ", logoDomain: "nvidia.com", logoTreatment: "light", logoScale: 0.68 },
  { symbol: "SAMSUNG", company: "Samsung Electronics", exchange: "KRX", logoDomain: "samsung.com", logoTreatment: "light", logoScale: 0.62 },
  { symbol: "SANDISK", company: "SanDisk", exchange: "NASDAQ", logoDomain: "sandisk.com", logoTreatment: "light", logoScale: 0.57 },
  { symbol: "SKHYNIX", company: "SK Hynix", exchange: "KRX", logoDomain: "skhynix.com", logoTreatment: "light", logoScale: 0.58 },
  { symbol: "SOFTBANK", company: "SoftBank Group", exchange: "TSE", logoDomain: "group.softbank", logoTreatment: "light", logoScale: 0.58 },
  { symbol: "SONY", company: "Sony Group", exchange: "TSE", logoDomain: "sony.com", logoTreatment: "light", logoScale: 0.61 },
  { symbol: "SPACEX", company: "SpaceX", exchange: "PRIVATE", logoDomain: "spacex.com", logoTreatment: "light", logoScale: 0.64 },
  { symbol: "TENCENT", company: "Tencent Holdings", exchange: "HKEX", logoDomain: "tencent.com", logoTreatment: "light", logoScale: 0.59 },
  { symbol: "TOKYOELEC", company: "Tokyo Electron", exchange: "TSE", logoDomain: "tel.com", logoTreatment: "light", logoScale: 0.59 },
  { symbol: "TSLA", company: "Tesla", exchange: "NASDAQ", logoDomain: "tesla.com", logoTreatment: "light", logoScale: 0.56 },
  { symbol: "ZHIPU", company: "Zhipu AI", exchange: "PRIVATE", logoDomain: "z.ai", logoTreatment: "light", logoScale: 0.56 },
];
