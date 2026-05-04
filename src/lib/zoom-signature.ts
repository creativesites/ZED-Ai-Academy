import { KJUR } from 'jsrsasign';

export function generateZoomSignature(meetingNumber: string, role: number) {
  const sdkKey = process.env.ZOOM_CLIENT_ID;
  const sdkSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!sdkKey || !sdkSecret) {
    throw new Error('Zoom SDK Key or Secret not found in environment variables');
  }

  const iat = Math.round(new Date().getTime() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;

  const oHeader = { alg: 'HS256', typ: 'JWT' };

  const oPayload = {
    sdkKey: sdkKey,
    mn: meetingNumber,
    role: role,
    iat: iat,
    exp: exp,
    appKey: sdkKey,
    tokenExp: iat + 60 * 60 * 2
  };

  const sHeader = JSON.stringify(oHeader);
  const sPayload = JSON.stringify(oPayload);
  const sdkSignature = KJUR.jws.JWS.sign('HS256', sHeader, sPayload, sdkSecret);

  return sdkSignature;
}
