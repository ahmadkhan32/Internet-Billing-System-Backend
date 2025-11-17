const express = require('express');
const router = express.Router();
const { getISPs, getISP } = require('../controllers/ispController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Get all ISPs (Super Admin can see all, Admin can see their own)
router.get('/', getISPs);

// Get single ISP (Super Admin, or Admin can see their own)
router.get('/:id', getISP);

module.exports = router;

