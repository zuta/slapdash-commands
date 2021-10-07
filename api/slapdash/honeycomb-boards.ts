import { VercelRequest, VercelResponse } from "@vercel/node";
import { CommandResponse } from "@slapdash/command-response-types";
import fetch from "node-fetch";

const CONFIG_API_KEY = "api-key";

export default async (req: VercelRequest, res: VercelResponse) => {
  const apiKey = req.headers[CONFIG_API_KEY]?.toString();
  let response: CommandResponse;
  if (apiKey) {
    try {
      const apiResponse = await fetch("https://api.honeycomb.io/1/boards", {
        method: "GET",
        headers: { "X-Honeycomb-Team": apiKey },
      });
      if (apiResponse.status !== 200) {
        response = {
          action: {
            type: "show-toast",
            message: `The request to Honeycomb failed. Please make sure your API key is valid and has permissions to access Honeycomb Boards.`,
          },
        };
      } else {
        const boards = await apiResponse.json();
        response = {
          view: {
            type: "list",
            options: boards.map((board: any) => ({
              title: board.name,
              subtitle:
                board.description ??
                board.queries
                  .map((query: any) => query.caption)
                  .filter((i: any) => !!i),
              icon: { monochrome: BOARD_ICON },
              action: {
                type: "open-url",
                url: `https://ui.honeycomb.io/slapdash/board/${board.id}`,
              },
            })),
          },
        };
      }
    } catch (e: any) {
      response = {
        action: {
          type: "show-toast",
          message: `Error: ${e.toString()}`,
        },
      };
    }
  } else {
    response = {
      config: {
        form: {
          fields: [
            {
              type: "text",
              id: CONFIG_API_KEY,
              label: "Honeycomb API Key",
              placeholder: "Paste your Team API Key",
              helpText: `You can generate a new API Key on your team's settings page in [Honeycomb](https://ui.honeycomb.io/teams). Please make sure to enable access to Honeycomb Boards when creating a new key.`,
            },
          ],
        },
      },
    };
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", CONFIG_API_KEY);
  res.json(response);
};

const BOARD_ICON = `<svg width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M2.462 0c.652 0 1.278.306 1.74.852.462.546.721 1.286.721 2.057v55.273h56.615c.653 0 1.28.306 1.741.852.462.545.721 1.285.721 2.057 0 .771-.26 1.511-.721 2.057-.462.545-1.088.852-1.74.852H2.462c-.653 0-1.28-.306-1.741-.852C.259 62.602 0 61.862 0 61.091V2.909C0 2.138.26 1.398.721.852 1.183.306 1.809 0 2.461 0Z" fill="#000"/><path fill-rule="evenodd" clip-rule="evenodd" d="M63.39 20.953c.213.277.376.599.48.948a3.16 3.16 0 0 1-.125 2.14c-.144.33-.343.624-.587.866l-19.691 19.6a2.307 2.307 0 0 1-1.53.691 2.264 2.264 0 0 1-1.57-.559l-18.094-15.44-18.19 18.108a2.409 2.409 0 0 1-.833.546 2.185 2.185 0 0 1-1.88-.144 2.53 2.53 0 0 1-.761-.666 2.917 2.917 0 0 1-.48-.947 3.161 3.161 0 0 1 .126-2.14 2.79 2.79 0 0 1 .586-.865l19.692-19.6a2.308 2.308 0 0 1 1.528-.69 2.264 2.264 0 0 1 1.569.558l18.096 15.44 18.19-18.109c.492-.488 1.134-.734 1.784-.684.651.05 1.258.392 1.687.95l.003-.003Z" fill="#000"/></svg>`;
