import { VercelRequest, VercelResponse } from "@vercel/node";
import { CommandResponse, Icon } from "@slapdash/command-response-types";
import fetch from "node-fetch";

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const API_BASE = "https://api.unsplash.com";
const PARAM_ID = "id";

export default async (req: VercelRequest, res: VercelResponse) => {
  const query = req.query["keywords"]?.toString().trim() ?? "nature";
  const id = req.query[PARAM_ID]?.toString();
  const response = id ? await photoResponse(id) : await rootResponse(query);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(response);
};

async function rootResponse(query: string): Promise<CommandResponse> {
  const apiResponse = await fetch(
    `${API_BASE}/search/photos?query=${query}&per_page=30`,
    { method: "GET", headers: { Authorization: `Client-ID ${ACCESS_KEY}` } }
  );
  const { results } = (await apiResponse.json()) as { results: Photo[] };
  return {
    view: {
      type: "masonry",
      options: results.map((photo) => ({
        imageURL: photo.urls.small,
        action: {
          action: { type: "open-url", url: photo.links.html },
          label: "Open",
          tooltip: "Open in Unsplash",
          icon: UNSPLASH_ICON,
        },
        moveAction: { type: "add-param", name: PARAM_ID, value: photo.id },
      })),
    },
    inputPlaceholder: "Type to search Unsplash photos",
  };
}

async function photoResponse(id: string): Promise<CommandResponse> {
  const apiResponse = await fetch(`${API_BASE}/photos/${id}`, {
    method: "GET",
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  });
  const photo = (await apiResponse.json()) as Photo;
  return {
    tokens: [
      {
        paramName: PARAM_ID,
        label: photo.description || "photo",
        icon: photo.urls.thumb || photo.urls.small,
      },
    ],
    view: {
      type: "list",
      options: [
        {
          title: "Open in Unsplash",
          icon: UNSPLASH_ICON,
          action: { type: "open-url", url: photo.links.html },
        },
        {
          title: "Open Full Size Photo",
          icon: IMAGE_ICON,
          action: { type: "open-url", url: photo.urls.full },
        },
      ],
    },
  };
}

interface Photo {
  id: string;
  description?: string;
  urls: {
    small: string;
    thumb: string;
    full: string;
  };
  links: { html: string; download: string };
}

const UNSPLASH_ICON: Icon = {
  monochrome: `<svg width="44" height="44" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.75 12.375V0h16.5v12.375h-16.5Zm16.5 6.875H44V44H0V19.25h13.75v12.375h16.5V19.25Z" fill="#000"/></svg>`,
};

const IMAGE_ICON: Icon = {
  monochrome: `<svg width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M51.9993 51h-40c-2.20917 0-4.00003-1.7909-4.00003-4V17c0-2.2091 1.79086-4 4.00003-4h40c2.2091 0 4 1.7909 4 4v30c0 2.2091-1.7909 4-4 4Zm-.0057-5.5107L51.9991 18c0-.5523-.4477-1-1-1h-38c-.5523 0-1 .4477-1 1v27.5384c.0002.254.2063.4598.4604.4596.1494-.0002.2894-.0728.3755-.1949l4.4156-6.2726c.2341-.3327.6155-.5306 1.0224-.5305h2.3511l5.2518-7.469c.234-.3329.6155-.531 1.0224-.531h1.4519c.4068-.0001.7881.1979 1.0222.5306l10.659 15.1468c.1423.2023.3743.3227.6217.3226h.58c.4216 0 .7633-.3419.7633-.7635 0-.1571-.0485-.3104-.1389-.439l-2.6073-3.705c-.3234-.4595-.3118-1.0756.0288-1.5226l2.3446-3.0774c.2364-.3104.6043-.4926.9945-.4925h1.137c.3901 0 .7578.1822.9943.4925l6.3282 8.3058c.1704.2242.4904.2678.7146.0974.127-.0966.2015-.2469.2014-.4064ZM40.9993 31c-2.7615 0-5-2.2386-5-5s2.2385-5 5-5c2.7614 0 5 2.2386 5 5s-2.2386 5-5 5Z" fill="#000"/></svg>`,
  padding: "slapdash-system",
};
