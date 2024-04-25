import qrcode from "qrcode";
import invariant from "tiny-invariant";
import db from "../db.server";
import type { QRCode } from "@prisma/client";

export async function getQRCode(
  id: number,
  graphql: any,
): Promise<QRCode | null> {
  const qrCode = await db.qRCode.findFirst({ where: { id } });

  if (!qrCode) {
    return null;
  }

  return supplementQRCode(qrCode, graphql);
}

export async function getQRCodes(
  shop: string,
  graphql: any,
): Promise<QRCode[]> {
  const qrCodes = await db.qRCode.findMany({
    where: { shop },
    orderBy: { id: "desc" },
  });

  if (qrCodes.length === 0) return [];

  return Promise.all(
    qrCodes.map((qrCode) => supplementQRCode(qrCode, graphql)),
  );
}

export function getQRCodeImage(id: number): Promise<string> {
  const url = new URL(`/qrcodes/${id}/scan`, process.env.SHOPIFY_APP_URL);
  return qrcode.toDataURL(url.href);
}

export function getDestinationUrl(qrCode: QRCode): string {
  if (qrCode.destination === "product") {
    return `https://${qrCode.shop}/products/${qrCode.productHandle}`;
  }

  const match = /gid:\/\/shopify\/ProductVariant\/\d+/.exec(
    qrCode.productVariantId || "",
  );
  invariant(match, "Unrecognized product variant ID");

  return `https://${qrCode.shop}/cart/${match[1]}:1`;
}

async function supplementQRCode(
  qrCode: QRCode,
  graphql: any,
): Promise<
  QRCode & {
    productDeleted?: boolean;
    productTitle?: string;
    productImage?: string;
    productAlt?: string;
    destinationUrl?: string;
    image?: string;
  }
> {
  const qrCodeImagePromise = getQRCodeImage(qrCode.id);

  const response = await graphql(
    `
      query supplementQRCode($id: ID!) {
        product(id: $id) {
          title
          images(first: 1) {
            nodes {
              altText
              url
            }
          }
        }
      }
    `,
    {
      variables: {
        id: qrCode.productId,
      },
    },
  );

  const {
    data: { product },
  } = await response.json();

  return {
    ...qrCode,
    productDeleted: !product?.title,
    productTitle: product?.title,
    productImage: product?.images?.nodes[0]?.url,
    productAlt: product?.images?.nodes[0]?.altText,
    destinationUrl: getDestinationUrl(qrCode),
    image: await qrCodeImagePromise,
  };
}

export function validateQRCode(data: QRCode): { [key: string]: string } | null {
  const errors: { [key: string]: string } = {};

  if (!data.title) {
    errors.title = "Title is required";
  }

  if (!data.productId) {
    errors.productId = "Product is required";
  }

  if (!data.destination) {
    errors.destination = "Destination is required";
  }

  if (Object.keys(errors).length) {
    return errors;
  }

  return null;
}
