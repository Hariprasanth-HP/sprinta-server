// src/middleware/authMiddleware.ts

import { supabase } from '../controllers/auth/auth.controller'
import type {
  NextFunction,
  Request,
  Response
} from 'express'


export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth =
      req.headers.authorization
    if (!auth) {
      return res.status(401).json({
        error: 'Missing authorization header'
      })

    }
    const token = auth.split(' ')[1]
    if (!token) {
      return res.status(401).json({
        error: 'Invalid token'
      })

    }
    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token)

    if (error || !user) {

      return res.status(401).json({
        error: 'Unauthorized'
      })

    }

    req.user = user

    next()

  } catch (err) {

    return res.status(401).json({
      error: 'Invalid or expired token'
    })

  }

}