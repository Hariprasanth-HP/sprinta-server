// src/routes/authRoutes.ts

import cookieParser from "cookie-parser";
import express from "express";
import {
  getUser,
  login,
  logout,
  refresh,
  signup,
  supabaseGoogleAuth,
} from "../../controllers/auth/auth.controller";

const router = express.Router();
router.use(cookieParser());

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication routes
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: User signup
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 */
router.post("/signup", signup);

/**
 * @swagger
 * /api/auth/google/signup:
 *   post:
 *     summary: Signup with Google
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Google signup successful
 */
router.post("/google/signup", supabaseGoogleAuth);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/google/login:
 *   post:
 *     summary: Login with Google
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Google login successful
 */
router.post("/google/login", supabaseGoogleAuth);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     description: Uses refresh token stored in HTTP-only cookie
 *     responses:
 *       200:
 *         description: Token refreshed
 */
router.post("/refresh", refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post("/logout", logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Current user data
 */
router.get("/me", getUser);

export default router;
