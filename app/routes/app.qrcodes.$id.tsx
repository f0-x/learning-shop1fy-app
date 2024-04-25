import { json } from "@remix-run/node";
import { getQRCode } from "~/models/QRCode.server";
import { authenticate } from "~/shopify.server";

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const { admin } = await authenticate.admin(request);

  if (params.id === "new") {
    return json({
      destination: "product",
      title: "",
    });
  }

  return json(await getQRCode(Number(params.id), admin.graphql));
}