const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getNotifications,
  getNotification,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware, ispMiddleware } = require('../middlewares/roleMiddleware');

// Validation rules
const notificationValidation = [
  body('type').isIn(['bill_reminder', 'payment_received', 'bill_generated', 'overdue', 'service_update', 'system']).withMessage('Invalid notification type'),
  body('title').notEmpty().withMessage('Title is required'),
  body('message').notEmpty().withMessage('Message is required')
];

router.use(authMiddleware);
router.use(ispMiddleware);

router.get('/', getNotifications);
router.get('/:id', getNotification);
router.post('/', roleMiddleware('admin', 'account_manager', 'super_admin'), notificationValidation, createNotification);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;

