# Company header integration

`CompanyHeader` is the stateless 784×65 market header used by the app's `#header` view. It owns the supplied light/dark visual treatment and renders the shared `TickerOrb`; the host application owns market data, ticker selection, modal state and routing.

```tsx
import { CompanyHeader } from "@/components/header";

<CompanyHeader
  company="Samsung Electronics"
  market="KRX"
  ticker="SMSG"
  number="5930"
  palette={orb.palette}
  price="$213.23"
  change="+$22.35"
  changePercent="+50%"
  changePositive
  stats={[
    { label: "Mark", value: "$213.23" },
    { label: "Index", value: "$213.23" },
    { label: "24h Vol", value: "$95.2M" },
    { label: "Open Interest", value: "420.0M" },
    { label: "Funding", value: "+0.021%" },
  ]}
  pickerOpen={pickerOpen}
  onOpenPicker={() => setPickerOpen(true)}
/>
```

The component inherits theme from the document or any ancestor using `data-theme="dark"`, matching the orb contract. `onOpenPicker` is intentionally UI-only: connect it to any dialog, command menu or market search in the consuming front end. The example app keeps selection keyed by `market + exchangeTicker`, so inserting or reordering dataset rows does not change the selected asset.

At narrow widths the reference page scrolls the header horizontally instead of shrinking its 48px orb or wrapping financial values. A product integration can progressively hide lower-priority stats if a different mobile treatment is required.
