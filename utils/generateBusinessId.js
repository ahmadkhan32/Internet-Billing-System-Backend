/**
 * Generate unique Business ID
 * Format: BIZ-YYYY-NNNN (e.g., BIZ-2024-0001)
 */

const { ISP } = require('../models');
const { Op } = require('sequelize');

/**
 * Generate a unique business ID
 * @returns {Promise<string>} Unique business ID in format BIZ-YYYY-NNNN
 */
const generateBusinessId = async () => {
  const year = new Date().getFullYear();
  const prefix = `BIZ-${year}-`;
  
  try {
    // Find the highest existing business_id for this year
    const existingISPs = await ISP.findAll({
      where: {
        business_id: {
          [Op.like]: `${prefix}%`
        }
      },
      attributes: ['business_id'],
      order: [['business_id', 'DESC']],
      limit: 1
    });

    let nextNumber = 1;
    
    if (existingISPs.length > 0 && existingISPs[0].business_id) {
      // Extract the number from the last business_id
      const lastId = existingISPs[0].business_id;
      const lastNumber = parseInt(lastId.split('-')[2]) || 0;
      nextNumber = lastNumber + 1;
    }

    // Format: BIZ-YYYY-NNNN (4 digits)
    const businessId = `${prefix}${String(nextNumber).padStart(4, '0')}`;
    
    // Double-check uniqueness (race condition protection)
    const exists = await ISP.findOne({ where: { business_id: businessId } });
    if (exists) {
      // If exists, try next number
      return generateBusinessId();
    }
    
    return businessId;
  } catch (error) {
    console.error('Error generating business ID:', error);
    // Fallback: use timestamp-based ID
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}${timestamp}`;
  }
};

/**
 * Validate business ID format
 * @param {string} businessId - Business ID to validate
 * @returns {boolean} True if valid format
 */
const isValidBusinessId = (businessId) => {
  if (!businessId || typeof businessId !== 'string') {
    return false;
  }
  // Format: BIZ-YYYY-NNNN
  const pattern = /^BIZ-\d{4}-\d{4}$/;
  return pattern.test(businessId);
};

module.exports = {
  generateBusinessId,
  isValidBusinessId
};

