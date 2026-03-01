import express from 'express'
import { getUser } from '../controllers/user.controllers.js';
import { isAuth } from '../middleware/isAuth.js';
const router = express.Router()

router.get("/current-user", isAuth, getUser)


export default router