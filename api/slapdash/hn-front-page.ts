import { VercelRequest, VercelResponse } from "@vercel/node";
import { CommandResponse } from "@slapdash/command-response-types";
import Parser from "rss-parser";

const RSS_FEED_URL = "https://hnrss.org/frontpage";
const PARAM_ID = "page";

const SVG_HN_LOGO = `<svg width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M48 48H0V0h48v48z" fill="#FF6D00"/><path d="M28 14l-4 8.1-4.1-8.1H16l5.9 12v8H26v-8l5.9-12H28z" fill="#fff"/></svg>`;
const SVG_PAGE = `<svg width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M34.7273 0H8v64h49V22.8572L34.7273 0zm0 6.464l15.974 16.3932h-15.974V6.464zm17.8182 52.9645h-40.091V4.57147h17.8182V27.4285h22.2728v32zm-35.6364-22.857h31.1818V32H16.9091v4.5715zm0 9.1428h31.1818v-4.5715H16.9091v4.5715zm0 9.1429h31.1818v-4.5715H16.9091v4.5715z" fill="#000"/></svg>`;

export default async (req: VercelRequest, res: VercelResponse) => {
  const id = req.query[PARAM_ID]?.toString();
  const response = id ? await pageResponse(id) : await rootResponse();
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "max-age=0, s-maxage=600");
  res.json(response);
};

async function rootResponse(): Promise<CommandResponse> {
  const feed = await parseFeed();
  return {
    view: {
      type: "list",
      options: feed.items.map((item) => ({
        title: item.title,
        subtitle: getSubtitle(item),
        icon: { monochrome: SVG_PAGE },
        action: {
          type: "open-url",
          url: item.link,
        },
        moveAction: {
          type: "add-param",
          name: PARAM_ID,
          value: item.guid,
        },
      })),
    },
  };
}

function getSubtitle(item: Parser.Item) {
  const points = item.contentSnippet.match(/Points:\s*(\d+)/)[1];
  const comments = item.contentSnippet.match(/Comments:\s*(\d+)/)[1];
  const pieces = [item.creator];
  if (points) {
    pieces.push(`${points} Points`);
  }
  if (comments) {
    pieces.push(`${comments} Comments`);
  }
  return pieces;
}

async function pageResponse(id: string): Promise<CommandResponse> {
  const feed = await parseFeed();
  const item = feed.items.find((i) => i.guid === id);
  return item
    ? {
        tokens: [
          {
            paramName: PARAM_ID,
            icon: { monochrome: SVG_PAGE },
            label: item.title,
          },
        ],
        view: {
          type: "list",
          options: [
            {
              title: "Open",
              action: { type: "open-url", url: item.link },
            },
            {
              title: "Open on Hacker News",
              icon: SVG_HN_LOGO,
              action: { type: "open-url", url: item.guid },
            },
          ],
        },
      }
    : { view: "Oops, something went wrong!" };
}

async function parseFeed() {
  return new Parser().parseURL(RSS_FEED_URL);
}
