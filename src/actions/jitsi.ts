"use server";

import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { currentUser } from "@clerk/nextjs/server";

const APP_ID = "vpaas-magic-cookie-37a3214c11ef406c81cc165d3d1c2f4f";
const KID = "vpaas-magic-cookie-37a3214c11ef406c81cc165d3d1c2f4f/5c30b9"; 

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

    const now = new Date();
    const jwtToken = jwt.sign({
      aud: 'jitsi',
      context: {
        user: {
          id: user.id,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "Anonymous",
          avatar: user.imageUrl || "",
          email: user.emailAddresses[0]?.emailAddress || "",
          moderator: moderator ? 'true' : 'false'
        },
        features: {
          livestreaming: 'true',
          recording: 'true',
          transcription: 'true',
          "outbound-call": 'true'
        }
      },
      iss: 'chat',
      room: '*',
      sub: APP_ID,
      exp: Math.round(now.setHours(now.getHours() + 3) / 1000),
      nbf: (Math.round((new Date).getTime() / 1000) - 10)
    }, privateKey, { 
      algorithm: 'RS256', 
      header: { kid: KID, typ: "JWT", alg: "RS256" } 
    });

    return { success: true, token: jwtToken };
  } catch (error: any) {
    console.error("Error generating Jitsi token:", error);
    return { success: false, error: error.message };
  }
}
