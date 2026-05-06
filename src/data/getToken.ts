import "server-only";
import { KJUR } from "jsrsasign";

function generateSignature(sessionName: string, role: number) {
  if (!process.env.ZOOM_CLIENT_ID || !process.env.ZOOM_CLIENT_SECRET) {
    throw new Error("Missing ZOOM_CLIENT_ID or ZOOM_CLIENT_SECRET");
  }
  const iat = Math.round(new Date().getTime() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;
  const oHeader = { alg: "HS256", typ: "JWT" };
  const sdkKey = process.env.ZOOM_CLIENT_ID;
  const sdkSecret = process.env.ZOOM_CLIENT_SECRET;
  const oPayload = {
    app_key: sdkKey, tpc: sessionName, role_type: role, version: 1, iat: iat, exp: exp,
  };
  const sHeader = JSON.stringify(oHeader);
  const sPayload = JSON.stringify(oPayload);
  const sdkJWT = KJUR.jws.JWS.sign("HS256", sHeader, sPayload, sdkSecret);
  return sdkJWT;
}

export async function getData(slug: string) {
  const JWT = await generateSignature(slug, 1);
  return JWT;
}