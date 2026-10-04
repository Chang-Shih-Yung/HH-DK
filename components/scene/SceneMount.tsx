"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, type ReactNode } from "react";
import { setUI } from "@/lib/store";

// three.js and the scene are a separate chunk, fetched after the page itself is
// interactive. The HTML (text, navigation, pictures) never waits for WebGL.
const load = () => import("./Scene");
const Scene = dynamic(load, { ssr: false });

// If WebGL is unavailable or the scene throws, the page carries on with its vector logo.
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("The 3D scene is unavailable; showing the static page.", error);
    setUI({ sceneFailed: true });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function SceneMount() {
  // Start the download as soon as the page hydrates, rather than whenever React gets
  // round to this boundary (which a throttled background tab can put off for seconds).
  useEffect(() => {
    void load();
  }, []);

  return (
    <Boundary>
      <Scene />
    </Boundary>
  );
}
