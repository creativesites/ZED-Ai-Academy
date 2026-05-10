"use server";

import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { currentUser } from "@clerk/nextjs/server";

const APP_ID = "vpaas-magic-cookie-37a3214c11ef406c81cc165d3d1c2f4f";
// Decoded from the sample app JWT provided by the user
const KID = "vpaas-magic-cookie-37a3214c11ef406c81cc165d3d1c2f4f/b91378-SAMPLE_APP"; 

export async function generateJitsiToken(roomName: string, moderator = false) {
  try {
    const user = await currentUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const privateKeyPath = path.join(process.cwd(), "jitsi", "private-key.pk");
    if (!fs.existsSync(privateKeyPath)) {
      throw new Error("Jitsi private key not found at jitsi/private-key.pk");
    }

    const privateKey = fs.readFileSync(privateKeyPath, "utf8");

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 7200; // 2 hours

    const payload = {
      aud: "jitsi",
      iss: "chat",
      sub: APP_ID,
      room: roomName,
      iat: now,
      nbf: now,
      exp: exp,
      context: {
        user: {
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "Anonymous",
          email: user.emailAddresses[0]?.emailAddress || "",
          avatar: user.imageUrl || "",
          id: user.id,
          moderator,
        },
        features: {
          livestreaming: "true",
          recording: "true",
          transcription: "true",
          "outbound-call": "false",
          "sip-outbound-call": "false",
          "file-upload": "true",
        },
      },
    };

    const token = jwt.sign(payload, privateKey, {
      algorithm: "RS256",
      header: {
        kid: KID,
        typ: "JWT",
        alg: "RS256",
      },
    });

    return { success: true, token };
  } catch (error: any) {
    console.error("Error generating Jitsi token:", error);
    return { success: false, error: error.message };
  }
}
