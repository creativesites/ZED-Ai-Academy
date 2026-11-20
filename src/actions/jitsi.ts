"use server";

import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentTenantAccess, isTeachingRole } from "@/lib/tenants/access";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type JitsiTokenRequest =
  | {
      scope: "classroom";
      companyId: string;
      cohortId?: string | null;
    }
  | {
      scope: "booking";
      bookingId: string;
      roomName?: string;
    }
  | {
      scope: "test";
      roomName: string;
    };

export type JitsiTokenResult =
  | {
      success: true;
      token: string;
      appId: string;
      roomName: string;
      isModerator: boolean;
    }
  | {
      success: false;
      error: string;
    };

function loadJitsiConfig(): { appId: string; kid: string; privateKey: string } {
  const appId =
    process.env.JITSI_APP_ID?.trim() ||
    process.env.NEXT_PUBLIC_JITSI_APP_ID?.trim();
  const kid = process.env.JITSI_KID?.trim();

  let privateKey = process.env.JITSI_PRIVATE_KEY?.trim();
  if (!privateKey && process.env.JITSI_PRIVATE_KEY_BASE64?.trim()) {
    privateKey = Buffer.from(
      process.env.JITSI_PRIVATE_KEY_BASE64.trim(),
      "base64"
    ).toString("utf8");
  }
  if (privateKey) {
    // Support single-line env vars with escaped \n
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  // Dev-only fallback to local key file when env vars aren't configured yet
  if (!privateKey && process.env.NODE_ENV !== "production") {
    const privateKeyPath = path.join(process.cwd(), "jitsi", "private-key.pk");
    if (fs.existsSync(privateKeyPath)) {
      privateKey = fs.readFileSync(privateKeyPath, "utf8");
    }
  }

  if (!appId || !kid || !privateKey) {
    throw new Error(
      "Jitsi JaaS credentials are not configured. Set JITSI_APP_ID, JITSI_KID, and JITSI_PRIVATE_KEY."
    );
  }

  return { appId, kid, privateKey };
}

function sanitizeRoomName(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!cleaned) {
    throw new Error("Invalid room name.");
  }
  return cleaned;
}

/**
 * Generates a scoped Jitsi JaaS JWT.
 * Moderator privileges and room access are ALWAYS derived server-side from
 * tenant/booking authorization — never trusted from client arguments.
 */
export async function generateJitsiToken(
  request: JitsiTokenRequest
): Promise<JitsiTokenResult> {
  try {
    const user = await currentUser();
    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    const { appId, kid, privateKey } = loadJitsiConfig();
    const service = createServiceClient();

    let resolvedRoomName = "";
    let isModerator = false;

    if (request.scope === "classroom") {
      const access = await getCurrentTenantAccess(request.companyId);
      if (!access || (!access.isSuperAdmin && !access.isMember)) {
        return {
          success: false,
          error: "You do not have access to this academy classroom.",
        };
      }

      isModerator = Boolean(
        access.isSuperAdmin || access.isOwner || isTeachingRole(access.tenantRole)
      );

      const isCohortScoped = Boolean(
        request.cohortId && request.cohortId !== "all"
      );

      if (isCohortScoped) {
        const { data: group } = await service
          .from("classroom_groups")
          .select("is_session_active, active_room_name")
          .eq("id", request.cohortId!)
          .eq("company_id", request.companyId)
          .maybeSingle();

        if (!group?.is_session_active || !group.active_room_name) {
          return {
            success: false,
            error: "No active live session for this class.",
          };
        }

        // Verify learner belongs to the cohort (instructors/admins may join any cohort)
        if (!isModerator) {
          const { data: memberRow } = await service
            .from("classroom_group_members")
            .select("profile_id")
            .eq("group_id", request.cohortId!)
            .eq("profile_id", user.id)
            .maybeSingle();

          // If the cohort has explicit members, enforce membership
          const { count: cohortMemberCount } = await service
            .from("classroom_group_members")
            .select("profile_id", { count: "exact", head: true })
            .eq("group_id", request.cohortId!);

          if ((cohortMemberCount ?? 0) > 0 && !memberRow) {
            return {
              success: false,
              error: "You are not enrolled in this class cohort.",
            };
          }
        }

        resolvedRoomName = sanitizeRoomName(group.active_room_name);
      } else {
        const { data: company } = await service
          .from("companies")
          .select("is_session_active, active_room_name")
          .eq("id", request.companyId)
          .maybeSingle();

        if (!company?.is_session_active || !company.active_room_name) {
          return {
            success: false,
            error: "No active live session for this academy.",
          };
        }

        resolvedRoomName = sanitizeRoomName(company.active_room_name);
      }
    } else if (request.scope === "booking") {
      const { data: profile } = await service
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const isSuperAdmin = profile?.role === "super_admin";

      if (UUID_REGEX.test(request.bookingId)) {
        const { data: booking } = await service
          .from("live_session_bookings")
          .select("id, learner_id, instructor_id, status")
          .eq("id", request.bookingId)
          .maybeSingle();

        if (booking) {
          const isParticipant =
            booking.learner_id === user.id ||
            booking.instructor_id === user.id ||
            isSuperAdmin;

          if (!isParticipant) {
            return {
              success: false,
              error: "You are not a participant in this live session.",
            };
          }

          isModerator = booking.instructor_id === user.id || isSuperAdmin;
          resolvedRoomName = sanitizeRoomName(
            request.roomName || `zed-live-${booking.id}`
          );
        } else {
          // Fallback for standalone lesson UUIDs
          isModerator = isSuperAdmin;
          resolvedRoomName = sanitizeRoomName(
            request.roomName || request.bookingId
          );
        }
      } else {
        // Standalone coursework meeting block (never grants moderator to learners)
        isModerator = isSuperAdmin;
        resolvedRoomName = sanitizeRoomName(
          request.roomName || request.bookingId
        );
      }
    } else if (request.scope === "test") {
      const { data: profile } = await service
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const isSuperAdmin = profile?.role === "super_admin";

      if (process.env.NODE_ENV === "production" && !isSuperAdmin) {
        return {
          success: false,
          error: "Test studio is restricted to super admins in production.",
        };
      }

      isModerator = isSuperAdmin || process.env.NODE_ENV !== "production";
      resolvedRoomName = sanitizeRoomName(request.roomName);
    } else {
      return { success: false, error: "Invalid Jitsi token scope." };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const jwtToken = jwt.sign(
      {
        aud: "jitsi",
        context: {
          user: {
            id: user.id,
            name:
              `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              user.username ||
              "Anonymous",
            avatar: user.imageUrl || "",
            email: user.emailAddresses[0]?.emailAddress || "",
            moderator: isModerator ? "true" : "false",
          },
          features: {
            livestreaming: isModerator ? "true" : "false",
            recording: isModerator ? "true" : "false",
            transcription: isModerator ? "true" : "false",
            "outbound-call": "false",
          },
        },
        iss: "chat",
        room: resolvedRoomName,
        sub: appId,
        exp: nowSec + 3 * 60 * 60,
        nbf: nowSec - 10,
      },
      privateKey,
      {
        algorithm: "RS256",
        header: { kid, typ: "JWT", alg: "RS256" },
      }
    );

    return {
      success: true,
      token: jwtToken,
      appId,
      roomName: resolvedRoomName,
      isModerator,
    };
  } catch (error: any) {
    console.error("Error generating Jitsi token:", error);
    return {
      success: false,
      error: error?.message || "Failed to generate session token.",
    };
  }
}
