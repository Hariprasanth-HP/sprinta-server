import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import type { Request, Response } from "express";

dotenv.config();

const prisma = new PrismaClient();
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
  const { data, error } =
    await supabase.auth.signUp({
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

  const user = await prisma.user.create({
    data: {
      id: authUser.id,
      email: authUser.email!,
      name: name ?? "User",
      picture,
      provider: "LOCAL",
    },
  });

  return res.json({
    data: {
      user,
      session: data.session,
    }
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
  } catch (error) {
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
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error(error.message);
  } else {
    console.log("Password updated successfully");
  }
};
export const supabaseGoogleAuth = async (req: Request, res: Response) => {
  const { email, name, picture, supabaseId } = req.body;
  console.log("reqbodyy", req.body);
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    if (user.provider === "LOCAL") {
      user = await prisma.user.update({
        where: { email },
        data: {
          googleId: supabaseId,
          provider: "GOOGLE",
          picture: picture ?? user.picture,
        },
      });
    }

    return res.json(user);
  }
  user = await prisma.user.create({
    data: {
      email,
      name: name ?? "User",
      picture,
      id: supabaseId,
      provider: "GOOGLE",
    },
  });

  return res.json({ data: user, error: undefined });
};
