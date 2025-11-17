const express = require('express');
const router = express.Router();
const {
  getActivityLogs,
  getActivityLog,
  getEntityActivityLogs
} = require('../controllers/activityLogController');
const authMiddleware = require('../middlewares/authMiddleware');
const { roleMiddleware, ispMiddleware } = require('../middlewares/roleMiddleware');

router.use(authMiddleware);
router.use(ispMiddleware);

router.get('/', roleMiddleware('admin', 'super_admin'), getActivityLogs);
router.get('/:id', roleMiddleware('admin', 'super_admin'), getActivityLog);
router.get('/entity/:entity_type/:entity_id', roleMiddleware('admin', 'super_admin'), getEntityActivityLogs);

module.exports = router;

