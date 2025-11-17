const { ActivityLog } = require('../models');

/**
 * Create an activity log entry
 * @param {number} userId - User ID who performed the action
 * @param {string} action - Action name (e.g., 'CREATE_CUSTOMER', 'UPDATE_BILL')
 * @param {string} entityType - Type of entity (e.g., 'Customer', 'Bill')
 * @param {number} entityId - ID of the affected entity
 * @param {object} oldValues - Previous values (optional)
 * @param {object} newValues - New values (optional)
 * @param {number} ispId - ISP ID (optional)
 * @param {string} ipAddress - IP address (optional)
 * @param {string} userAgent - User agent (optional)
 * @param {string} description - Additional description (optional)
 */
const createActivityLog = async (
  userId,
  action,
  entityType,
  entityId,
  oldValues = null,
  newValues = null,
  ispId = null,
  ipAddress = null,
  userAgent = null,
  description = null
) => {
  try {
    await ActivityLog.create({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues,
      new_values: newValues,
      description,
      ip_address: ipAddress,
      user_agent: userAgent,
      isp_id: ispId
    });
  } catch (error) {
    console.error('Error creating activity log:', error);
    // Don't throw error - activity logging should not break the main flow
  }
};

module.exports = createActivityLog;

