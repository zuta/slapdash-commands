import { VercelRequest, VercelResponse } from "@vercel/node";
import { CommandResponse, ListOption } from "@slapdash/command-response-types";
import fetch from "node-fetch";

const CONFIG = {
  COUNT: "count",
  PREMIUM: "premium",
  TYPE: "type",
  STYLE: "style",
};

const PARAM = {
  KEYWORDS: "keywords",
  ID: "id",
};

const API_KEY = process.env.ICONFINDER_API_KEY;

export default async (req: VercelRequest, res: VercelResponse) => {
  const config = {
    count: req.headers[CONFIG.COUNT]?.toString(),
    premium: req.headers[CONFIG.PREMIUM]?.toString(),
    type: req.headers[CONFIG.TYPE]?.toString(),
    style: req.headers[CONFIG.STYLE]?.toString(),
  };
  const keywords = req.query[PARAM.KEYWORDS]?.toString() ?? "";
  const id = req.query[PARAM.ID]?.toString() ?? "";
  const response: CommandResponse = config[CONFIG.COUNT]
    ? id
      ? await iconResponse(id)
      : await rootResponse(keywords, config)
    : await configResponse();
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    Object.values(CONFIG).join(", ")
  );
  res.json(response);
};

async function configResponse(): Promise<CommandResponse> {
  const apiResponse = await fetch("https://api.iconfinder.com/v4/styles", {
    method: "GET",
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const { styles } = await apiResponse.json();
  // TODO: Add validation for config form.
  return {
    config: {
      form: {
        fields: [
          [
            {
              required: true,
              id: CONFIG.COUNT,
              label: "Count",
              type: "text",
              defaultValue: "10",
            },
            {
              id: CONFIG.PREMIUM,
              label: "Include Premium",
              type: "toggle",
              defaultValue: false,
            },
          ],
          [
            {
              id: CONFIG.TYPE,
              label: "Type",
              type: "select",
              defaultValue: "all",
              options: [
                { label: "All", value: "all" },
                { label: "Raster Only", value: "0" },
                { label: "Vector Only", value: "1" },
              ],
            },
            {
              id: CONFIG.STYLE,
              label: "Style",
              type: "select",
              defaultValue: "",
              options: styles.map((style) => ({
                label: style.name,
                value: style.identifier,
              })),
            },
          ],
        ],
      },
    },
  };
}

async function rootResponse(
  query: string,
  {
    count,
    type,
    style,
    premium,
  }: { count: string; premium?: string; type?: string; style?: string }
): Promise<CommandResponse> {
  premium = premium === "true" ? "all" : "0";
  style = style ?? "";
  type = type ?? "";
  const apiResponse = await apiCall(
    `search?query=${query}&count=${count}&vector=${type}&premium=${premium}&style=${style}`
  );
  const { icons } = (await apiResponse.json()) as { icons: Icon[] };
  return {
    view: {
      type: "list",
      options: await Promise.all(
        icons.map(async (icon): Promise<ListOption> => {
          const [iconPreview, svg] = await Promise.all([
            getIconPreview(icon),
            getSVG(icon),
          ]);
          return {
            title: icon.tags.join(" "),
            icon: iconPreview,
            subtitle: [icon.type, icon.is_premium ? "Premium" : "Free"],
            action: svg
              ? { type: "paste", value: svg }
              : {
                  type: "open-url",
                  url: `https://www.iconfinder.com/icons/${icon.icon_id}/`,
                },
            moveAction: {
              type: "add-param",
              name: PARAM.ID,
              value: icon.icon_id.toString(),
            },
          };
        })
      ),
      ranking: false,
    },
  };
}

async function iconResponse(id: string): Promise<CommandResponse> {
  const apiResponse = await apiCall(id);
  const icon: Icon = await apiResponse.json();
  const [svg, previewIcon] = await Promise.all([
    getSVG(icon),
    getIconPreview(icon),
  ]);
  return {
    tokens: [
      { paramName: PARAM.ID, icon: previewIcon, label: icon.tags.join(" ") },
    ],
    view: {
      type: "list",
      options: [
        {
          title: "Open in Iconfinder",
          action: {
            type: "open-url",
            url: `https://www.iconfinder.com/icons/${icon.icon_id}/`,
          },
        },
        {
          title: "Copy URL",
          action: {
            type: "copy",
            value: `https://www.iconfinder.com/icons/${icon.icon_id}/`,
          },
        },
        ...(svg
          ? ([
              {
                title: "Copy SVG",
                action: { type: "copy", value: svg },
              },
              {
                title: "Paste SVG",
                action: { type: "paste", value: svg },
              },
            ] as ListOption[])
          : []),
      ],
    },
  };
}

async function getIconPreview(icon: Icon) {
  const svg = await getSVG(icon);
  if (svg) {
    const colors = new Set(
      [
        ...svg.matchAll(/fill="(#\w+)"/gm),
        ...svg.matchAll(/fill:(#\w+)/gm),
      ].map((m) => m[1])
    );
    return colors.size < 2 ? { monochrome: svg } : svg;
  }

  return icon.raster_sizes[icon.raster_sizes.length - 1].formats[0].preview_url;
}

async function getSVG(icon: Icon) {
  const SVG_PREFIXES = ["<svg ", "<?xml "];
  if (icon.type === "vector" && icon.vector_sizes) {
    const url =
      icon.vector_sizes[icon.vector_sizes.length - 1].formats[0].download_url;
    const apiResponse = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const text = await apiResponse.text();
    return SVG_PREFIXES.some((prefix) => text.startsWith(prefix)) ? text : null;
  }

  return null;
}

async function apiCall(path: string, init?: Omit<RequestInit, "headers">) {
  return fetch(`https://api.iconfinder.com/v4/icons/${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
  });
}

// See https://developer.iconfinder.com/reference/icon
interface Icon {
  icon_id: number;
  type: "vector" | "raster";
  is_premium: boolean;
  vector_sizes?: VectorSize[];
  raster_sizes: RasterSize[];
  tags: string[];
}

interface VectorSize {
  size: number;
  size_height: number;
  size_width: number;
  formats: Array<{ download_url: string; format: string }>;
}

interface RasterSize {
  size: number;
  size_height: number;
  size_width: number;
  formats: Array<{
    preview_url: string;
    download_url: string;
    format: string;
  }>;
}
