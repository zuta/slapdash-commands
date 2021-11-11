import { VercelRequest, VercelResponse } from "@vercel/node";
import { CommandResponse, Icon } from "@slapdash/command-response-types";
import fetch from "node-fetch";
import approx from "approximate-number";

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
            `★${shortNumber(
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
        icon: PACKAGE_ICON,
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
      { paramName: PARAM_PACKAGE, label: metadata.name, icon: PACKAGE_ICON },
    ],
    view: {
      type: "list",
      options: compact([
        {
          title: `Open on NPM`,
          subtitle: metadata.links.npm,
          icon: NPM_ICON,
          action: { type: "open-url", url: metadata.links.npm },
        },
        metadata.links.repository && {
          title: `Open Repository`,
          subtitle: metadata.links.repository,
          icon: GITHUB_REPO_ICON,
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

function shortNumber(n: number) {
  return approx(n, { capital: true });
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
    return GITHUB_ICON;
  }

  return `https://${url.hostname}/favicon.ico`;
}

function compact<T>(a: Array<T | null | undefined>): T[] {
  return a.filter((a) => !!a);
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

const PACKAGE_ICON: Icon = {
  monochrome: `<svg width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m12.89 1.45 8 4c.3332.16558.6136.42083.8097.73704.1961.31622.3001.68088.3003 1.05296v9.53c-.0002.3721-.1042.7367-.3003 1.053-.1961.3162-.4765.5714-.8097.737l-8 4c-.2779.139-.5843.2114-.895.2114s-.6171-.0724-.895-.2114l-8-4c-.33287-.1677-.61225-.4251-.80661-.7432-.19437-.318-.29598-.6841-.29339-1.0568V7.24c.0002-.37208.10419-.73674.30028-1.05296.19609-.31621.47651-.57146.80972-.73704l8-4c.2766-.13742.5812-.20894.89-.20894.3088 0 .6134.07152.89.20894v0Z" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.32 6.16 12 11l9.68-4.84M12 22.76V11M7 3.5l10 5" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

const NPM_ICON: Icon = `<svg width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h64v64H0V0Z" fill="#C00"/><path d="M31.7825 6.87354H6.87366V57.1238H31.7799V19.5455h12.672v37.5783h12.672V6.87354H31.7825Z" fill="#fff"/></svg>`;

const GITHUB_REPO_ICON: Icon = {
  monochrome: `<svg width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.1111 21.0174V23.75l-3.33332-2.186-3.33334 2.186v-2.7326h-.55555c-1.0314 0-2.02055-.403-2.74986-1.1204C2.40972 19.1795 2 18.2065 2 17.1919V3.52907c0-.86966.35119-1.70371.97631-2.31865C3.60143.595473 4.44928.25 5.33333.25H20.8889c.2947 0 .5773.115157.7857.320139.2083.204982.3254.483001.3254.772881V19.9244c0 .2899-.1171.5679-.3254.7729-.2084.205-.491.3201-.7857.3201h-7.7778Zm0-2.186h6.6667v-3.2791H5.88889c-.44203 0-.86595.1728-1.17851.4802-.31256.3075-.48816.7245-.48816 1.1594 0 .4348.1756.8518.48816 1.1593.31256.3075.73648.4802 1.17851.4802h.55555v-2.1861h6.66666v2.1861Zm6.6667-5.4651V2.43605H5.33333V13.4045c.18403-.0257.36969-.0384.55556-.0382H19.7778ZM6.44444 3.52907h2.22223v2.18605H6.44444V3.52907Zm0 3.27907h2.22223v2.18605H6.44444V6.80814Zm0 3.27906h2.22223v2.1861H6.44444v-2.1861Z" fill="#000"/></svg>`,
};

const GITHUB_ICON: Icon = {
  monochrome: `<svg width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M32 0C14.32 0 0 14.32 0 32c0 14.16 9.16 26.12 21.88 30.36 1.6.28 2.2-.68 2.2-1.52 0-.76-.04-3.28-.04-5.96-8.04 1.48-10.12-1.96-10.76-3.76-.36-.92-1.92-3.76-3.28-4.52-1.12-.6-2.72-2.08-.04-2.12 2.52-.04 4.32 2.32 4.92 3.28 2.88 4.84 7.48 3.48 9.32 2.64.28-2.08 1.12-3.48 2.04-4.28-7.12-.8-14.56-3.56-14.56-15.8 0-3.48 1.24-6.36 3.28-8.6-.32-.8-1.44-4.08.32-8.48 0 0 2.68-.84 8.8 3.28 2.56-.72 5.28-1.08 8-1.08 2.72 0 5.44.36 8 1.08 6.12-4.16 8.8-3.28 8.8-3.28 1.76 4.4.64 7.68.32 8.48 2.04 2.24 3.28 5.08 3.28 8.6 0 12.28-7.48 15-14.6 15.8 1.16 1 2.16 2.92 2.16 5.92 0 4.28-.04 7.72-.04 8.8 0 .84.6 1.84 2.2 1.52 6.3526-2.1446 11.8727-6.2273 15.7834-11.6735C61.894 45.2403 63.9983 38.7048 64 32 64 14.32 49.68 0 32 0Z" fill="#000"/></svg>`,
};
