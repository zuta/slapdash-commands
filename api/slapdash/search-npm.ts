import { CommandResponse } from "@slapdash/command-response-types";
import { VercelRequest, VercelResponse } from "@vercel/node";
import fetch from "node-fetch";
import * as icons from "../../slapdash/icons";
import compact from "../../utils/compact";
import formatNumber from "../../utils/formatNumber";

const API_BASE = "https://api.npms.io/v2";
const PARAM_PACKAGE = "package";

export default async (req: VercelRequest, res: VercelResponse) => {
  const query = req.query["keywords"]?.toString().trim();
  const packageName = req.query[PARAM_PACKAGE]?.toString();
  const response = packageName
    ? await packageResponse(packageName)
    : await rootResponse(query);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(response);
};

async function rootResponse(query: string): Promise<CommandResponse> {
  let results: Array<{ package: Package }> = [];
  let packageInfos: Record<string, PackageInfo> = {};
  if (query) {
    const apiResponse = await fetch(
      `${API_BASE}/search?q=${encodeURIComponent(query)}`,
      { method: "GET" }
    );
    results = (
      (await apiResponse.json()) as {
        results: Array<{ package: Package }>;
      }
    ).results;
    packageInfos = await getPackageInfos(
      results.map((item) => item.package.name)
    );
  }
  return {
    inputPlaceholder: "Type to search NPM packages",
    view: {
      type: "list",
      ranking: false,
      options: results.map((item) => ({
        title:
          item.package.name +
          (item.package.description ? " – " + item.package.description : ""),
        subtitle: compact([
          new Date(item.package.date).toLocaleDateString("en-GB", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          packageInfos[item.package.name].collected.github &&
            `★${formatNumber(
              packageInfos[item.package.name].collected.github.starsCount
            )}`,
          `Quality ${formatScore(
            packageInfos[item.package.name].score.detail.quality
          )}`,
          `Popularity ${formatScore(
            packageInfos[item.package.name].score.detail.popularity
          )}`,
          `Maintenance ${formatScore(
            packageInfos[item.package.name].score.detail.maintenance
          )}`,
        ]),
        icon: icons.PACKAGE,
        action: { type: "open-url", url: item.package.links.npm },
        moveAction: {
          type: "add-param",
          name: PARAM_PACKAGE,
          value: item.package.name,
        },
      })),
    },
  };
}

async function packageResponse(packageName: string): Promise<CommandResponse> {
  const apiResponse = await fetch(
    `${API_BASE}/package/${encodeURIComponent(packageName)}`,
    { method: "GET" }
  );
  const {
    collected: { metadata },
  } = (await apiResponse.json()) as PackageInfo;
  return {
    tokens: [
      {
        paramName: PARAM_PACKAGE,
        label: metadata.name,
        icon: icons.PACKAGE,
      },
    ],
    view: {
      type: "list",
      options: compact([
        {
          title: `Open on NPM`,
          subtitle: metadata.links.npm,
          icon: icons.NPM,
          action: { type: "open-url", url: metadata.links.npm },
        },
        metadata.links.repository && {
          title: `Open Repository`,
          subtitle: metadata.links.repository,
          icon: icons.GITHUB_REPO,
          action: { type: "open-url", url: metadata.links.repository },
        },
        metadata.links.homepage && {
          title: `Open Homepage`,
          subtitle: metadata.links.homepage,
          icon: getIcon(metadata.links.homepage),
          action: { type: "open-url", url: metadata.links.homepage },
        },
        metadata.links.bugs && {
          title: `Open Bugs`,
          subtitle: metadata.links.bugs,
          icon: getIcon(metadata.links.bugs),
          action: { type: "open-url", url: metadata.links.bugs },
        },
        {
          group: "Install",
          title: "Copy NPM install command",
          subtitle: `npm i ${metadata.name}`,
          action: { type: "copy", value: `npm i ${metadata.name}` },
        },
        {
          group: "Install",
          title: "Copy Yarn install command",
          subtitle: `yarn add ${metadata.name}`,
          action: { type: "copy", value: `yarn add ${metadata.name}` },
        },
      ]),
    },
  };
}

function formatScore(score: number) {
  return Math.round(score * 100) + "%";
}

async function getPackageInfos(names: string[]) {
  const apiResponse = await fetch(`${API_BASE}/package/mget`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(names),
  });
  return (await apiResponse.json()) as Record<string, PackageInfo>;
}

function getIcon(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.hostname === "github.com") {
    return icons.GITHUB;
  }

  return `https://${url.hostname}/favicon.ico`;
}

interface Package {
  name: string;
  version: string;
  description: string | null;
  date: string;
  links: {
    npm: string;
    homepage?: string;
    repository?: string;
    bugs?: string;
  };
}

interface PackageInfo {
  collected: {
    github?: {
      starsCount: number;
      forksCount: number;
      subscribersCount: number;
      issues: {
        count: number;
        openCount: number;
      };
    };
    metadata: {
      name: string;
      version: string;
      description: string;
      date: string;
      links: {
        npm: string;
        homepage?: string;
        repository?: string;
        bugs?: string;
      };
    };
  };
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
}
