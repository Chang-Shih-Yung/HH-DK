import { preload } from "react-dom";
import { PictureLens } from "@/components/app/PictureLens";
import { Runtime } from "@/components/app/Runtime";
import { Scroller } from "@/components/app/Scroller";
import { Cursor } from "@/components/chrome/Cursor";
import { Grid } from "@/components/chrome/Grid";
import { Header } from "@/components/chrome/Header";
import { Loader } from "@/components/chrome/Loader";
import { MobileMenu } from "@/components/chrome/MobileMenu";
import { ScrollIndicator } from "@/components/chrome/ScrollIndicator";
import { SceneMount } from "@/components/scene/SceneMount";
import { Direction } from "@/components/sections/Direction";
import { Edit } from "@/components/sections/Edit";
import { Hero } from "@/components/sections/Hero";
import { StreetNotes } from "@/components/sections/StreetNotes";
import { Lightbox } from "@/components/ui/Lightbox";
import { WordmarkDefs } from "@/components/ui/Wordmark";
import { LOGO } from "@/lib/config";

// Layers, bottom to top: ambient glow → WebGL canvas → scrolling page → hairline grid →
// scroll position → phone menu → header frame → cursor → loader.
export default function Home() {
  // The logo model starts downloading with the HTML instead of after the scene chunk.
  preload(LOGO.url, { as: "fetch", crossOrigin: "anonymous" });

  return (
    <>
      <WordmarkDefs />
      <Loader />
      <div id="app">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 opacity-40 [background:radial-gradient(ellipse_at_75%_45%,#292c33_0%,var(--bg)_65%)] [html[data-mode=light]_&]:hidden"
        />
        <SceneMount />
        <Scroller>
          <main>
            <Hero />
            <Edit />
            <StreetNotes />
            <Direction />
          </main>
        </Scroller>
        <Grid />
        <ScrollIndicator />
        <MobileMenu />
        <Header />
      </div>
      <Cursor />
      <Lightbox />
      <PictureLens />
      <Runtime />
    </>
  );
}
