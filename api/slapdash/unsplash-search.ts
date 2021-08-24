import { VercelRequest, VercelResponse } from "@vercel/node";
import { CommandResponse } from "@slapdash/command-response-types";
import fetch from "node-fetch";

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

export default async (req: VercelRequest, res: VercelResponse) => {
  const query = req.query["keywords"]?.toString().trim() ?? "nature";
  const apiResponse = await fetch(
    `https://api.unsplash.com/search/photos?query=${query}&orientation=squarish&per_page=30`,
    {
      method: "GET",
      headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
    }
  );
  const { results } = await apiResponse.json();
  const response: CommandResponse = {
    view: {
      type: "masonry",
      options: results.map(({ urls }) => ({
        imageURL: urls.small,
        action: { type: "open-url", url: urls.raw },
      })),
    },
    inputPlaceholder: "Type to search Unsplash photos",
  };

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(response);
};
