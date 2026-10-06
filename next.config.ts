import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This folder is the project root, whatever lockfiles exist further up the disk.
  turbopack: { root: __dirname },
  // The dev badge sits exactly on the location label in the bottom-left corner.
  devIndicators: false,
  images: {
    // These small editorial files favour inexpensive WebP preparation and decoding.
    formats: ["image/webp"],
  },
  async headers() {
    return [
      {
        // Scene assets: cached for an hour and refreshed in the background, so a replaced
        // sticker or texture still reaches returning visitors the same day.
        source: "/:dir(models|textures|stickers|brand|audio)/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
