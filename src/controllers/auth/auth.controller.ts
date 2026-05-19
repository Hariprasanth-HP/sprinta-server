import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import type { Request, Response } from "express";
import { prisma } from "../../db";

dotenv.config();

export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
export const signup = async (
  req: Request,
  res: Response
) => {

  const {
    email,
    password,
    name,
    picture,
  } = req.body;

  // Create Supabase auth user
  const {
    data,
    error,
  } = await supabase.auth.signUp({
    email,
    password,

    options: {
      data: {
        name,
        picture,
      },
    },
  });

  if (error) {
    return res.status(400).json({
      error: error.message,
    });
  }

  const authUser = data.user;

  if (!authUser) {
    return res.status(400).json({
      error: "User creation failed",
    });
  }

  // Check existing user by email
  let user =
    await prisma.user.findUnique({
      where: {
        email: authUser.email!,
      },
    });

  if (user) {

    // Update existing invited user
    user = await prisma.user.update({
      where: {
        email: authUser.email!,
      },

      data: {
        id: authUser.id,

        name: name ?? user.name,

        picture:
          picture ?? user.picture,
      },
    });

  } else {

    // Create fresh user
    user = await prisma.user.create({
      data: {
        id: authUser.id,

        email: authUser.email!,

        name: name ?? "User",

        picture,

        provider: "LOCAL",
      },
    });
  }

  // Attach pending memberships
  await prisma.teamMember.updateMany({
    where: {
      email: authUser.email!,
      userId: null,
    },

    data: {
      userId: authUser.id,
    },
  });

  return res.json({
    data: {
      user,
      session: data.session,
    },
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return res.status(401).json({ error: error.message, data: undefined, success: false });

  return res.json({ data, error: undefined });
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: "No refresh token" });
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  // Optional: rotate refresh token
  res.cookie("refreshToken", data.session?.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });

  return res.json({
    accessToken: data.session?.access_token,
  });
};
export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    // Optional: revoke session in Supabase
    if (refreshToken) {
      await supabase.auth.signOut();
    }

    // Clear cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return res.json({ message: "Logged out successfully" });
  } catch (_error) {
    return res.status(500).json({ error: "Logout failed" });
  }
};

export const getUser = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];

  const { data, error } = await supabase.auth.getUser(token);

  if (error) return res.status(401).json({ error: error.message });

  return res.json(data);
};

export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "http://localhost:3000/update-password",
  });

  if (error) {
    console.error(error.message);
  } else {
    console.log("Reset email sent");
  }
};

export const updatePassword = async (newPassword: string) => {
  const { data: _data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error(error.message);
  } else {
    console.log("Password updated successfully");
  }
};

export const supabaseGoogleAuth = async (
  req: Request,
  res: Response
) => {
  try {

    const {
      email,
      name,
      picture,
      supabaseId,
    } = req.body;

    if (!email || !supabaseId) {
      return res.status(400).json({
        data: null,
        error: "Email and supabaseId required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    let user =
      await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

    // Existing user
    if (user) {

      // Convert LOCAL → GOOGLE
      if (user.provider === "LOCAL") {

        user =
          await prisma.user.update({
            where: {
              email: normalizedEmail,
            },

            data: {
              id: supabaseId,

              googleId: supabaseId,

              provider: "GOOGLE",

              picture:
                picture ?? user.picture,

              name:
                name ?? user.name,
            },
          });

      } else {

        // Refresh profile info
        user =
          await prisma.user.update({
            where: {
              email: normalizedEmail,
            },

            data: {
              picture:
                picture ?? user.picture,

              name:
                name ?? user.name,
            },
          });
      }

    } else {

      // New user
      user =
        await prisma.user.create({
          data: {
            id: supabaseId,

            email: normalizedEmail,

            name: name ?? "User",

            picture,

            provider: "GOOGLE",

            googleId: supabaseId,
          },
        });
    }

    // Attach pending team memberships
    await prisma.teamMember.updateMany({
      where: {
        email: normalizedEmail,
        userId: null,
      },

      data: {
        userId: supabaseId,
      },
    });

    return res.status(
      user ? 200 : 201
    ).json({
      data: user,
      error: null,
    });

  } catch (error: any) {

    console.error(
      "Google Auth Error:",
      error
    );

    return res.status(500).json({
      data: null,

      error:
        error?.message ||
        "Something went wrong during Google authentication",
    });
  }
};
