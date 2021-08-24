import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  CommandResponse,
  Icon,
  ListOption,
} from "@slapdash/command-response-types";
import fetch from "node-fetch";
import { frameworks } from "@vercel/frameworks";

const CONFIG_TOKEN = "token";
const PARAM_PROJECT = "project";

const VERCEL_ICON: Icon = {
  monochrome: `<svg height="26" viewBox="0 0 75 65" fill="#000" xmlns="http://www.w3.org/2000/svg"><path d="M37.59.25l36.95 64H.64l36.95-64z"></path></svg>`,
};

export default async (req: VercelRequest, res: VercelResponse) => {
  const token = req.headers[CONFIG_TOKEN]?.toString();
  const projectID = req.query[PARAM_PROJECT]?.toString();
  let response: CommandResponse;
  try {
    response = token
      ? projectID
        ? await projectResponse(token, projectID)
        : await projectsResponse(token)
      : await configResponse();
  } catch (e) {
    response = {
      action: {
        type: "show-toast",
        message: `Error: ${e.toString()}`,
      },
    };
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", CONFIG_TOKEN);
  res.json(response);
};

async function projectsResponse(token: string): Promise<CommandResponse> {
  const apiResponse = await fetch("https://api.vercel.com/v8/projects/", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const { projects } = await apiResponse.json();
  return {
    view: {
      type: "list",
      options: projects.map((project): ListOption => {
        const framework = findFramework(project.framework);
        return {
          title: project.name,
          subtitle: [
            framework.name,
            new Date(project.updatedAt).toLocaleTimeString("en-US", {
              year: "numeric",
              month: "numeric",
              day: "numeric",
              hour: "numeric",
              minute: "numeric",
            }),
          ],
          icon: framework.logo,
          action: {
            type: "open-url",
            url: getVercelProjectURL(project),
          },
          moveAction: {
            type: "add-param",
            name: PARAM_PROJECT,
            value: project.id,
          },
        };
      }),
    },
  };
}

async function projectResponse(
  token: string,
  projectID: string
): Promise<CommandResponse> {
  const [projectApiResponse, domainsApiResponse] = await Promise.all([
    fetch(`https://api.vercel.com/v8/projects/${projectID}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`https://api.vercel.com/v8/projects/${projectID}/domains`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);
  const [project, { domains }] = await Promise.all([
    projectApiResponse.json(),
    domainsApiResponse.json(),
  ]);
  const framework = findFramework(project.framework);
  return {
    tokens: [
      {
        paramName: PARAM_PROJECT,
        label: project.name,
        icon: framework.logo,
      },
    ],
    view: {
      type: "list",
      options: [
        {
          title: "Open in Vercel",
          icon: VERCEL_ICON,
          action: {
            type: "open-url",
            url: getVercelProjectURL(project),
          },
        },
        ...domains.map(
          (domain): ListOption => ({
            title: "Open App",
            subtitle: [domain.name],
            action: {
              type: "open-url",
              url: `https://${domain.name}`,
            },
          })
        ),
        ...domains.map(
          (domain): ListOption => ({
            title: `Copy App URL`,
            subtitle: [domain.name],
            action: {
              type: "copy",
              value: `https://${domain.name}`,
            },
          })
        ),
      ],
    },
  };
}

async function configResponse(): Promise<CommandResponse> {
  return {
    config: {
      form: {
        fields: [
          {
            type: "text",
            id: CONFIG_TOKEN,
            label: "Vercel Access Token",
            helpText:
              "Grab your personal access token on [Vercel](https://vercel.com/account/tokens)",
          },
        ],
      },
    },
  };
}

function getVercelProjectURL(project: { name: string; accountId: string }) {
  return `https://vercel.com/${project.accountId}/${project.name}`;
}

function findFramework(slug: string | null) {
  return frameworks.find((f) => f.slug === slug);
}
