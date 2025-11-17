const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getDashboard,
  getAllISPs,
  createISP,
  updateISP,
  deleteISP,
  downloadSRS,
  subscribeISP,
  updateISPStatus,
  getISPAnalytics
} = require('../controllers/superAdminController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);
router.use(roleMiddleware('super_admin')); // Only Super Admin

router.get('/dashboard', getDashboard);
router.get('/isps', getAllISPs);
router.post('/isps', [
  body('name').optional().isString().withMessage('Business name must be a string'),
  body('owner_name').optional().isString().withMessage('Owner name must be a string'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('contact').optional().isString().withMessage('Contact must be a string'),
  body('address').optional().isString().withMessage('Address must be a string'),
  body('status').optional().isIn(['active', 'pending', 'suspended', 'cancelled', 'expired']).withMessage('Invalid status'),
  body('saas_package_id').optional().isInt().withMessage('SaaS package ID must be an integer')
], createISP);
router.put('/isps/:id', [
  body('name').optional().isString().withMessage('Business name must be a string'),
  body('owner_name').optional().isString().withMessage('Owner name must be a string'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('contact').optional().isString().withMessage('Contact must be a string'),
  body('address').optional().isString().withMessage('Address must be a string'),
  body('status').optional().isIn(['active', 'pending', 'suspended', 'cancelled', 'expired']).withMessage('Invalid status'),
  body('saas_package_id').optional().isInt().withMessage('SaaS package ID must be an integer')
], updateISP);
router.delete('/isps/:id', deleteISP);
router.get('/isps/:id/analytics', getISPAnalytics);
router.get('/isps/:id/srs', downloadSRS);
router.post('/isps/:id/subscribe', [
  body('package_id').notEmpty().withMessage('Package ID is required')
], subscribeISP);
router.put('/isps/:id/status', [
  body('status').notEmpty().withMessage('Status is required')
], updateISPStatus);

module.exports = router;

