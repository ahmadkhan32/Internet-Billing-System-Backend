const { Customer, Package } = require('../models');

/**
 * Calculate remaining data for a customer
 * @param {number} customerId - Customer ID
 * @returns {object} - { used, limit, remaining, percentage_used }
 */
const calculateRemainingData = async (customerId) => {
  try {
    const customer = await Customer.findByPk(customerId, {
      include: [{ model: Package, as: 'package' }]
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const used = parseFloat(customer.data_usage) || 0;
    const limit = customer.data_limit || customer.package?.data_limit || null;

    if (limit === null) {
      return {
        used,
        limit: null,
        remaining: null,
        percentage_used: 0,
        is_unlimited: true
      };
    }

    const remaining = Math.max(0, limit - used);
    const percentage_used = limit > 0 ? (used / limit) * 100 : 0;

    return {
      used,
      limit,
      remaining,
      percentage_used: Math.min(100, percentage_used),
      is_unlimited: false
    };
  } catch (error) {
    console.error('Error calculating remaining data:', error);
    throw error;
  }
};

/**
 * Update customer data usage
 * @param {number} customerId - Customer ID
 * @param {number} dataUsed - Data used in GB
 */
const updateDataUsage = async (customerId, dataUsed) => {
  try {
    const customer = await Customer.findByPk(customerId);
    
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Get data limit from package if not set on customer
    if (!customer.data_limit && customer.package_id) {
      const package = await Package.findByPk(customer.package_id);
      if (package) {
        customer.data_limit = package.data_limit;
        await customer.save();
      }
    }

    customer.data_usage = parseFloat(customer.data_usage || 0) + parseFloat(dataUsed);
    await customer.save();

    return await calculateRemainingData(customerId);
  } catch (error) {
    console.error('Error updating data usage:', error);
    throw error;
  }
};

/**
 * Reset monthly data usage for a customer
 * @param {number} customerId - Customer ID
 */
const resetMonthlyDataUsage = async (customerId) => {
  try {
    const customer = await Customer.findByPk(customerId);
    
    if (!customer) {
      throw new Error('Customer not found');
    }

    customer.data_usage = 0;
    customer.data_reset_date = new Date();
    await customer.save();

    return customer;
  } catch (error) {
    console.error('Error resetting data usage:', error);
    throw error;
  }
};

/**
 * Check if customer has exceeded data limit
 * @param {number} customerId - Customer ID
 * @returns {object} - { exceeded, used, limit, remaining }
 */
const checkDataLimit = async (customerId) => {
  try {
    const dataInfo = await calculateRemainingData(customerId);
    
    if (dataInfo.is_unlimited) {
      return {
        exceeded: false,
        ...dataInfo
      };
    }

    return {
      exceeded: dataInfo.remaining <= 0,
      ...dataInfo
    };
  } catch (error) {
    console.error('Error checking data limit:', error);
    throw error;
  }
};

module.exports = {
  calculateRemainingData,
  updateDataUsage,
  resetMonthlyDataUsage,
  checkDataLimit
};
