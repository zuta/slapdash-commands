import { CommandResponse } from "@slapdash/command-response-types";
import { VercelRequest, VercelResponse } from "@vercel/node";
import { format } from "fecha";
import fetch, { Response } from "node-fetch";
import * as icons from "../../slapdash/icons";
import compact from "../../utils/compact";
import formatNumber from "../../utils/formatNumber";

const PARAMS = { REPO: "repo" };
const CONFIG = { ACCESS_TOKEN: "access-token" };

export default async (req: VercelRequest, res: VercelResponse) => {
  const params = getParams(req);
  const config = getConfig(req);
  let response: CommandResponse = {};
  try {
    response = config.ACCESS_TOKEN
      ? params.REPO
        ? await repoResponse(req, params.REPO)
        : await rootResponse(req)
      : await configResponse(req);
  } catch (e) {
    response = await errorResponse(req, e);
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    Object.values(CONFIG).join(", ")
  );
  res.json(response);
};

async function configResponse(
  req: VercelRequest,
  error?: string
): Promise<CommandResponse> {
  const config = getConfig(req);
  return {
    config: {
      form: {
        error,
        fields: [
          {
            type: "text",
            id: CONFIG.ACCESS_TOKEN,
            defaultValue: config.ACCESS_TOKEN,
            label: "Github Access Token",
            placeholder: "Paste your access token here",
            helpText: `
To create a new access token:

- Go to [Developers Settings](https://github.com/settings/tokens/new).
- Press **Generate token**.
- Copy the token and paste it in the field above.
`,
          },
        ],
      },
    },
  };
}

async function rootResponse(req: VercelRequest): Promise<CommandResponse> {
  const {
    viewer: {
      starredRepositories: { edges },
    },
  } = await graphQLRequest<{
    viewer: {
      starredRepositories: {
        edges: Array<{ starredAt: string; node: Repository }>;
      };
    };
  }>(
    getConfig(req).ACCESS_TOKEN,
    `{
      viewer {
        starredRepositories(first: 100, orderBy: {field: STARRED_AT, direction: DESC}) {
          edges {
            starredAt
            node {
              id
              name
              description
              url
              stargazerCount
              forkCount
            }
          }
        }
      }
    }`
  );
  const repos = edges.map((e) => ({ ...e.node, starredAt: e.starredAt }));

  return {
    inputPlaceholder: "Type to search your starred repos...",
    view: {
      type: "list",
      options: repos.map((repo) => ({
        title: repo.description
          ? `${repo.name} - ${repo.description}`
          : repo.name,
        subtitle: [
          `${format(new Date(repo.starredAt), "D MMM YY")}`,
          `☆${formatNumber(repo.stargazerCount)}`,
          `⑂${formatNumber(repo.forkCount)}`,
        ],
        icon: icons.GITHUB_REPO,
        action: {
          label: "Open",
          tooltip: "Open on Github",
          icon: icons.GITHUB,
          action: {
            type: "open-url",
            url: repo.url,
          },
        },
        moveAction: { type: "add-param", name: PARAMS.REPO, value: repo.id },
      })),
    },
  };
}

async function repoResponse(
  req: VercelRequest,
  repoID: string
): Promise<CommandResponse> {
  const { node } = await graphQLRequest<{
    node: {
      nameWithOwner: string;
      url: string;
      homepageUrl?: string;
    };
  }>(
    getConfig(req).ACCESS_TOKEN,
    `{
      node(id: "${repoID}") {
        ... on Repository {
          nameWithOwner
          url
          homepageUrl
        }
      }
    }`
  );
  return {
    tokens: [
      {
        paramName: PARAMS.REPO,
        label: node.nameWithOwner,
        icon: icons.GITHUB_REPO,
      },
    ],
    view: {
      type: "list",
      options: compact([
        {
          title: `Open on Github`,
          icon: icons.GITHUB,
          subtitle: [node.url],
          action: { type: "open-url", url: node.url },
        },
        node.homepageUrl && {
          title: `Open Homepage`,
          subtitle: [node.homepageUrl],
          action: { type: "open-url", url: node.homepageUrl },
        },
        {
          title: `Copy Github URL`,
          subtitle: [node.url],
          action: { type: "copy", value: node.url },
        },
        node.homepageUrl && {
          title: `Copy Homepage URL`,
          subtitle: [node.homepageUrl],
          action: { type: "copy", value: node.homepageUrl },
        },
      ]),
    },
  };
}

async function errorResponse(
  req: VercelRequest,
  e: unknown
): Promise<CommandResponse> {
  console.log(e);
  if (e instanceof ApiError) {
    switch (e.response.status) {
      case 401:
        return configResponse(
          req,
          "It looks like this access token isn't valid or has expired. Try creating a new one."
        );
      default:
        break;
    }
  }

  return { view: "Oops! Sorry, something went wrong!" };
}

async function graphQLRequest<TData>(accessToken: string, query: string) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${accessToken}` },
    body: JSON.stringify({ query }),
  });
  const res = await response.json();
  if (response.status !== 200) {
    throw new ApiError(response);
  }

  return res.data as TData;
}

function getParams(req: VercelRequest) {
  return Object.entries(PARAMS).reduce(
    (agg, [key, name]) => ({
      ...agg,
      [key]: req.query[name]?.toString(),
    }),
    {} as Partial<Record<keyof typeof PARAMS, string>>
  );
}

function getConfig(req: VercelRequest) {
  return Object.entries(CONFIG).reduce(
    (agg, [key, name]) => ({
      ...agg,
      [key]: req.headers[name]?.toString(),
    }),
    {} as Partial<Record<keyof typeof CONFIG, string>>
  );
}

class ApiError extends Error {
  constructor(readonly response: Response) {
    super(response.statusText);
  }
}

interface Repository {
  id: string;
  name: string;
  description?: string;
  url: string;
  stargazerCount: number;
  forkCount: number;
}
