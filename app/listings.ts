export type Listing = {
  exchangeTicker: string;
  ticker: string;
  company: string;
  market: "HK" | "KR" | "JP";
  priority: "P0" | "P1";
};

export const listings: Listing[] = [
  { exchangeTicker: "0700", ticker: "TENC", company: "Tencent Holdings", market: "HK", priority: "P0" },
  { exchangeTicker: "9988", ticker: "BABA", company: "Alibaba Group", market: "HK", priority: "P0" },
  { exchangeTicker: "3690", ticker: "MEIT", company: "Meituan", market: "HK", priority: "P0" },
  { exchangeTicker: "1211", ticker: "BYD", company: "BYD Co H", market: "HK", priority: "P0" },
  { exchangeTicker: "100", ticker: "MINI", company: "MiniMax", market: "HK", priority: "P0" },
  { exchangeTicker: "005930", ticker: "SMSG", company: "Samsung Electronics", market: "KR", priority: "P0" },
  { exchangeTicker: "000660", ticker: "HYNX", company: "SK Hynix", market: "KR", priority: "P0" },
  { exchangeTicker: "373220", ticker: "LGES", company: "LG Energy Solution", market: "KR", priority: "P0" },
  { exchangeTicker: "000990", ticker: "DBHT", company: "DB HiTek", market: "KR", priority: "P1" },
  { exchangeTicker: "042700", ticker: "HANM", company: "Hanmi Semiconductor", market: "KR", priority: "P0" },
  { exchangeTicker: "058470", ticker: "LENO", company: "Leeno Industrial", market: "KR", priority: "P1" },
  { exchangeTicker: "240810", ticker: "WNIK", company: "Wonik IPS", market: "KR", priority: "P1" },
  { exchangeTicker: "012450", ticker: "HWAA", company: "Hanwha Aerospace", market: "KR", priority: "P0" },
  { exchangeTicker: "272210", ticker: "HWAS", company: "Hanwha Systems", market: "KR", priority: "P0" },
  { exchangeTicker: "047810", ticker: "KAI", company: "Korea Aerospace Industries", market: "KR", priority: "P0" },
  { exchangeTicker: "009540", ticker: "KSOE", company: "HD Korea Shipbuilding", market: "KR", priority: "P0" },
  { exchangeTicker: "042660", ticker: "HWO", company: "Hanwha Ocean", market: "KR", priority: "P0" },
  { exchangeTicker: "006400", ticker: "SSDI", company: "Samsung SDI", market: "KR", priority: "P1" },
  { exchangeTicker: "096770", ticker: "SKI", company: "SK Innovation", market: "KR", priority: "P1" },
  { exchangeTicker: "247540", ticker: "ECBM", company: "Ecopro BM", market: "KR", priority: "P0" },
  { exchangeTicker: "086520", ticker: "ECPR", company: "Ecopro", market: "KR", priority: "P1" },
  { exchangeTicker: "450080", ticker: "ECMT", company: "Ecopro Materials", market: "KR", priority: "P1" },
  { exchangeTicker: "034220", ticker: "LGD", company: "LG Display", market: "KR", priority: "P1" },
  { exchangeTicker: "011200", ticker: "HMM", company: "HMM", market: "KR", priority: "P0" },
  { exchangeTicker: "009830", ticker: "HWSL", company: "Hanwha Solutions", market: "KR", priority: "P1" },
  { exchangeTicker: "267260", ticker: "HDEC", company: "HD Hyundai Electric", market: "KR", priority: "P0" },
  { exchangeTicker: "034020", ticker: "DOOS", company: "Doosan Enerbility", market: "KR", priority: "P0" },
  { exchangeTicker: "000720", ticker: "HYEC", company: "Hyundai E&C", market: "KR", priority: "P1" },
  { exchangeTicker: "028260", ticker: "SMCT", company: "Samsung C&T", market: "KR", priority: "P1" },
  { exchangeTicker: "004020", ticker: "HYST", company: "Hyundai Steel", market: "KR", priority: "P1" },
  { exchangeTicker: "095340", ticker: "ISC", company: "ISC", market: "KR", priority: "P1" },
  { exchangeTicker: "403870", ticker: "HPSP", company: "HPSP", market: "KR", priority: "P1" },
  { exchangeTicker: "039030", ticker: "EOT", company: "EO Technics", market: "KR", priority: "P1" },
  { exchangeTicker: "6857", ticker: "ADVT", company: "Advantest", market: "JP", priority: "P0" },
  { exchangeTicker: "8001", ticker: "ITOC", company: "Itochu Corp", market: "JP", priority: "P0" },
  { exchangeTicker: "8002", ticker: "MARU", company: "Marubeni", market: "JP", priority: "P1" },
  { exchangeTicker: "6758", ticker: "SONY", company: "Sony Group", market: "JP", priority: "P0" },
  { exchangeTicker: "7974", ticker: "NTDO", company: "Nintendo", market: "JP", priority: "P0" },
];
