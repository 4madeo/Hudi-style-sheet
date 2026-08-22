import { listings } from "../../app/listings";
import brandColourManifest from "../../public/logos/brand-colours.json";
import { createLogoDevUrl } from "../../components/orb/logo-dev";
import { deriveOrbPalette } from "../../components/orb/palette";
import {
  createLogoOrbSvg,
  type OrbExportScaleName,
} from "../../components/orb/svg";

declare const __HUDI_LOGO_ASSETS__: Record<string, string>;

type OrbItem = (typeof orbItems)[number];

const scaleLabels: Record<OrbExportScaleName, string> = {
  generator: "Generator · 460",
  "ticker-page": "Gallery · 136",
  blotter: "Blotter · 24",
};

const logoDevToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
const logoDevFormat = process.env.NEXT_PUBLIC_LOGO_DEV_FORMAT === "png"
  || process.env.NEXT_PUBLIC_LOGO_DEV_FORMAT === "webp"
  || process.env.NEXT_PUBLIC_LOGO_DEV_FORMAT === "jpg"
  ? process.env.NEXT_PUBLIC_LOGO_DEV_FORMAT
  : "svg";

const orbItems = listings.map((listing) => ({
  ...listing,
  logoUrl: __HUDI_LOGO_ASSETS__[listing.symbol]
    ?? createLogoDevUrl(listing.logoDomain, { format: logoDevFormat, token: logoDevToken }),
  palette: deriveOrbPalette(brandColourManifest[listing.symbol as keyof typeof brandColourManifest]?.orbColour ?? "#394150"),
}));

const gallery = requiredElement<HTMLDivElement>("gallery");
const search = requiredElement<HTMLInputElement>("search");
const resultCount = requiredElement<HTMLSpanElement>("result-count");
const status = requiredElement<HTMLParagraphElement>("status");
const scaleButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-scale]"));
const logoCache = new Map<string, Promise<string>>();
const svgCache = new Map<string, Promise<string>>();

let activeScale: OrbExportScaleName = "ticker-page";

function requiredElement<T extends HTMLElement>(id: string) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing plugin UI element: ${id}`);
  return element as T;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read logo response"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function fetchLogo(item: OrbItem) {
  const cached = logoCache.get(item.logoUrl);
  if (cached) return cached;
  if (item.logoUrl.startsWith("data:")) {
    const request = Promise.resolve(item.logoUrl);
    logoCache.set(item.logoUrl, request);
    return request;
  }
  const request = fetch(item.logoUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Logo.dev returned ${response.status} for ${item.company}`);
      return response.blob();
    })
    .then(blobToDataUrl);
  logoCache.set(item.logoUrl, request);
  return request;
}

function orbKey(item: OrbItem) {
  return item.symbol;
}

function orbName(item: OrbItem) {
  return `${item.symbol} · ${scaleLabels[activeScale]}`;
}

async function createSvg(item: OrbItem) {
  const scale = activeScale;
  const key = `${scale}-${orbKey(item)}`;
  const cached = svgCache.get(key);
  if (cached) return cached;
  const request = fetchLogo(item).then((logoHref) => createLogoOrbSvg(
    logoHref,
    item.palette,
    scale,
    {
      logoTreatment: item.logoTreatment,
      logoScale: item.logoScale,
      title: `${item.company} ${scaleLabels[scale]} orb`,
    },
  ));
  svgCache.set(key, request);
  return request;
}

async function postInsert(item: OrbItem) {
  const name = orbName(item);
  status.textContent = `Preparing ${name}…`;
  parent.postMessage({
    pluginMessage: {
      type: "insert-orb",
      svg: await createSvg(item),
      name,
    },
  }, "*");
  status.textContent = `Inserting ${name}…`;
}

async function createCard(item: OrbItem) {
  const svg = await createSvg(item);
  const card = document.createElement("article");
  card.className = "orb-card";
  card.draggable = true;
  card.dataset.key = orbKey(item);
  card.title = `Insert ${item.company}`;

  const preview = document.createElement("div");
  preview.className = "orb-preview";
  preview.innerHTML = svg;

  const details = document.createElement("div");
  details.className = "orb-details";
  const label = document.createElement("div");
  label.className = "orb-label";
  const symbol = document.createElement("strong");
  symbol.textContent = item.symbol;
  const company = document.createElement("span");
  company.textContent = item.company;
  label.append(symbol, company);

  const insert = document.createElement("button");
  insert.type = "button";
  insert.className = "insert-button";
  insert.textContent = "Insert";
  insert.setAttribute("aria-label", `Insert ${item.company}`);
  insert.addEventListener("click", () => void postInsert(item));

  details.append(label, insert);
  card.append(preview, details);
  card.addEventListener("dragstart", (event) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", item.symbol);
  });
  card.addEventListener("dragend", (event) => {
    if (!event.view || event.view.length === 0) return;
    parent.postMessage({
      pluginDrop: {
        clientX: event.clientX,
        clientY: event.clientY,
        items: [{ type: "image/svg+xml", data: svg }],
        dropMetadata: { name: orbName(item) },
      },
    }, "*");
  });
  return card;
}

async function renderGallery() {
  const scaleAtStart = activeScale;
  const query = search.value.trim().toLocaleLowerCase();
  const filtered = orbItems.filter((item) => [
    item.symbol,
    item.company,
    item.exchange,
  ].some((value) => value.toLocaleLowerCase().includes(query)));

  gallery.dataset.loading = "true";
  const cards = await Promise.all(filtered.map(createCard));
  if (scaleAtStart !== activeScale) return;
  gallery.replaceChildren(...cards);
  resultCount.textContent = `${filtered.length} orb${filtered.length === 1 ? "" : "s"}`;
  gallery.dataset.empty = String(filtered.length === 0);
  gallery.dataset.loading = "false";
}

function setScale(scale: OrbExportScaleName) {
  activeScale = scale;
  for (const button of scaleButtons) {
    const selected = button.dataset.scale === scale;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  void renderGallery();
  status.textContent = `${scaleLabels[scale]} selected`;
}

for (const button of scaleButtons) {
  button.addEventListener("click", () => setScale(button.dataset.scale as OrbExportScaleName));
}

search.addEventListener("input", () => void renderGallery());

window.onmessage = (event) => {
  const message = event.data?.pluginMessage as { type?: string; name?: string; detail?: string } | undefined;
  if (message?.type === "inserted") status.textContent = `${message.name ?? "Orb"} inserted`;
  if (message?.type === "insert-error") status.textContent = `Couldn’t insert orb: ${message.detail ?? "unknown error"}`;
};

document.body.classList.remove("is-loading");
status.textContent = "Loading company logos from Logo.dev…";
void renderGallery()
  .then(() => { status.textContent = "Ready — choose an orb and click Insert"; })
  .catch((error) => {
    console.error("Unable to prepare logo orbs", error);
    status.textContent = "The Logo.dev assets could not be loaded. Check the publishable key and plan.";
    document.body.classList.add("has-error");
  });
