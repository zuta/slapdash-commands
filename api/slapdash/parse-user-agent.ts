import { VercelRequest, VercelResponse } from "@vercel/node";
import { CommandResponse } from "@slapdash/command-response-types";
import parse from "ua-parser-js";

export default async (req: VercelRequest, res: VercelResponse) => {
  const keywords = req.query["keywords"]?.toString();
  let view: CommandResponse["view"];
  if (keywords) {
    const ua = parse(keywords);
    view =
      (ua.os.name ? `OS: ${ua.os.name} ${ua.os.version}\n\n` : "") +
      (ua.browser.name
        ? `Browser: ${ua.browser.name} ${ua.browser.version}\n\n`
        : "") +
      (ua.device.vendor
        ? `Device: ${ua.device.vendor} ${ua.device.model} ${ua.device.type}\n\n`
        : "") +
      (ua.cpu.architecture
        ? `CPU Architecture: ${ua.cpu.architecture}\n\n`
        : "");
    if (view.trim().length === 0) {
      view = `Sorry, this doesn't look like a valid User-Agent string.`;
    }
  } else {
    view = "Paste a User-Agent string in the input field above.";
  }

  const response: CommandResponse = {
    inputPlaceholder: "Paste a User-Agent string",
    view,
  };
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(response);
};
