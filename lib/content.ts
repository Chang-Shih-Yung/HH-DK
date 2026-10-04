// Editorial photographs follow the approved black/cream streetwear identity.
import type { StaticImageData } from "next/image";
import hoodie from "@/assets/images/editorial/01-night-hoodie.webp";
import tee from "@/assets/images/editorial/02-daily-tee.webp";
import bag from "@/assets/images/editorial/03-city-bag.webp";
import cap from "@/assets/images/editorial/04-daily-cap.webp";
import layer from "@/assets/images/editorial/05-city-layer.webp";
import tote from "@/assets/images/editorial/06-everyday-tote.webp";
import evening from "@/assets/images/street-evening.jpg";
import crossing from "@/assets/images/crossing-bluehour.jpg";

export const NAV = [
  { id: "edit", label: "EDIT", aria: "The edit" },
  { id: "street", label: "STREET", aria: "Street notes" },
] as const;

export type Product = { image: StaticImageData; name: string; ja: string; type: string; alt: string };

export const PRODUCTS: Product[] = [
  { image: hoodie, name: "NIGHT HOODIE", ja: "フーディー", type: "WEAR", alt: "HH:DK charcoal hoodie worn on an evening backstreet" },
  { image: tee, name: "DAILY TEE", ja: "Tシャツ", type: "WEAR", alt: "HH:DK ivory T-shirt with black back print" },
  { image: bag, name: "CITY BAG", ja: "ショルダーバッグ", type: "BAG", alt: "HH:DK graphite messenger bag worn across an ivory tee" },
  { image: cap, name: "DAILY CAP", ja: "キャップ", type: "HEADWEAR", alt: "HH:DK embroidered washed black cap worn in the city" },
  { image: layer, name: "CITY LAYER", ja: "コーチジャケット", type: "OUTERWEAR", alt: "HH:DK ivory coach jacket with black chest logo" },
  { image: tote, name: "EVERYDAY TOTE", ja: "トートバッグ", type: "BAG", alt: "HH:DK ivory canvas tote carried on a quiet Japanese street" },
];

export type Street = { image: StaticImageData; name: string; alt: string; focus: number };

export const STREETS: Street[] = [
  { image: evening, name: "AFTER HOURS", alt: "Shibuya-inspired street style after dark", focus: 50 },
  { image: crossing, name: "THE CROSSING", alt: "Street style at a Shibuya-inspired crossing", focus: 38 },
];

export const LOCATION = { home: "SHIBUYA / HH:DK", short: "SHIBUYA", end: "HH:DK © 2026" };
