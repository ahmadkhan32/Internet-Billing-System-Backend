/**
 * AI Analytics and Insights Utility
 * Provides AI-driven analytics, fraud detection, and business insights
 */

const { Bill, Payment, Customer, Package, ISP } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');

/**
 * Calculate customer churn risk score (0-100)
 * Higher score = higher risk of churn
 */
const calculateChurnRisk = async (customerId) => {
  try {
    const customer = await Customer.findByPk(customerId, {
      include: [
        { model: Bill, as: 'bills' },
        { model: Payment, as: 'payments' }
      ]
    });

    if (!customer) {
      return { risk: 0, score: 0, factors: [] };
    }

    let riskScore = 0;
    const factors = [];

    // Factor 1: Overdue bills (40 points max)
    const overdueBills = customer.bills?.filter(b => b.status === 'overdue') || [];
    if (overdueBills.length > 0) {
      const overdueDays = overdueBills.map(bill => {
        return moment().diff(moment(bill.due_date), 'days');
      });
      const maxOverdueDays = Math.max(...overdueDays);
      const overdueScore = Math.min(40, maxOverdueDays * 2);
      riskScore += overdueScore;
      factors.push({
        factor: 'Overdue Bills',
        impact: overdueScore,
        details: `${overdueBills.length} overdue bill(s), max ${maxOverdueDays} days overdue`
      });
    }

    // Factor 2: Payment history (30 points max)
    const recentPayments = customer.payments?.filter(p => 
      moment(p.payment_date).isAfter(moment().subtract(90, 'days'))
    ) || [];
    const totalPayments = customer.payments?.length || 0;
    if (totalPayments > 0) {
      const latePayments = customer.payments?.filter(p => {
        const bill = customer.bills?.find(b => b.id === p.bill_id);
        return bill && moment(p.payment_date).isAfter(moment(bill.due_date));
      }).length || 0;
      const latePaymentRatio = latePayments / totalPayments;
      const paymentScore = Math.min(30, latePaymentRatio * 30);
      riskScore += paymentScore;
      factors.push({
        factor: 'Payment History',
        impact: paymentScore,
        details: `${latePayments}/${totalPayments} payments were late (${(latePaymentRatio * 100).toFixed(1)}%)`
      });
    }

    // Factor 3: Service status (20 points max)
    if (customer.status === 'suspended') {
      riskScore += 20;
      factors.push({
        factor: 'Service Status',
        impact: 20,
        details: 'Service is currently suspended'
      });
    } else if (customer.status === 'inactive') {
      riskScore += 10;
      factors.push({
        factor: 'Service Status',
        impact: 10,
        details: 'Service is inactive'
      });
    }

    // Factor 4: Account age and activity (10 points max)
    const accountAge = moment().diff(moment(customer.createdAt), 'months');
    if (accountAge < 3 && recentPayments.length === 0) {
      riskScore += 10;
      factors.push({
        factor: 'New Account',
        impact: 10,
        details: 'New account with no payment history'
      });
    }

    riskScore = Math.min(100, riskScore);

    let riskLevel = 'low';
    if (riskScore >= 70) riskLevel = 'critical';
    else if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';

    return {
      risk: riskLevel,
      score: riskScore,
      factors: factors,
      recommendation: getChurnRecommendation(riskLevel, factors)
    };
  } catch (error) {
    console.error('Error calculating churn risk:', error);
    return { risk: 'unknown', score: 0, factors: [], error: error.message };
  }
};

/**
 * Get recommendation based on churn risk
 */
const getChurnRecommendation = (riskLevel, factors) => {
  if (riskLevel === 'critical') {
    return 'Immediate action required. Contact customer immediately, offer payment plan or discount.';
  } else if (riskLevel === 'high') {
    return 'High priority. Send personalized reminder, consider payment extension.';
  } else if (riskLevel === 'medium') {
    return 'Monitor closely. Send standard reminder, check for service issues.';
  } else {
    return 'Low risk. Continue standard service.';
  }
};

/**
 * Detect potential fraud patterns
 */
const detectFraud = async (paymentData) => {
  try {
    const { customerId, amount, method, transactionId } = paymentData;
    const fraudIndicators = [];
    let fraudScore = 0;

    // Check 1: Unusual payment amount
    const customer = await Customer.findByPk(customerId, {
      include: [{ model: Package, as: 'package' }]
    });

    if (customer && customer.package) {
      const expectedAmount = parseFloat(customer.package.price);
      const paymentAmount = parseFloat(amount);
      const deviation = Math.abs(paymentAmount - expectedAmount) / expectedAmount;

      if (deviation > 0.5) { // More than 50% deviation
        fraudScore += 30;
        fraudIndicators.push({
          type: 'unusual_amount',
          severity: 'medium',
          message: `Payment amount (${amount}) deviates significantly from expected amount (${expectedAmount})`
        });
      }
    }

    // Check 2: Multiple payments in short time
    const recentPayments = await Payment.findAll({
      where: {
        customer_id: customerId,
        payment_date: {
          [Op.gte]: moment().subtract(1, 'hour').toDate()
        }
      }
    });

    if (recentPayments.length > 3) {
      fraudScore += 40;
      fraudIndicators.push({
        type: 'rapid_payments',
        severity: 'high',
        message: `${recentPayments.length} payments in the last hour - unusual pattern`
      });
    }

    // Check 3: Duplicate transaction ID
    const existingTransaction = await Payment.findOne({
      where: {
        transaction_id: transactionId,
        customer_id: { [Op.ne]: customerId }
      }
    });

    if (existingTransaction) {
      fraudScore += 50;
      fraudIndicators.push({
        type: 'duplicate_transaction',
        severity: 'critical',
        message: `Transaction ID ${transactionId} already used by another customer`
      });
    }

    // Check 4: Payment method mismatch
    const customerPayments = await Payment.findAll({
      where: { customer_id: customerId },
      order: [['payment_date', 'DESC']],
      limit: 5
    });

    if (customerPayments.length > 0) {
      const commonMethod = customerPayments[0].method;
      if (method !== commonMethod && method !== 'cash') {
        fraudScore += 20;
        fraudIndicators.push({
          type: 'method_change',
          severity: 'low',
          message: `Payment method changed from ${commonMethod} to ${method}`
        });
      }
    }

    let fraudLevel = 'none';
    if (fraudScore >= 70) fraudLevel = 'critical';
    else if (fraudScore >= 50) fraudLevel = 'high';
    else if (fraudScore >= 30) fraudLevel = 'medium';
    else if (fraudScore >= 10) fraudLevel = 'low';

    return {
      fraud: fraudLevel !== 'none',
      level: fraudLevel,
      score: fraudScore,
      indicators: fraudIndicators,
      recommendation: fraudLevel !== 'none' 
        ? 'Review payment manually before processing'
        : 'Payment appears legitimate'
    };
  } catch (error) {
    console.error('Error detecting fraud:', error);
    return {
      fraud: false,
      level: 'unknown',
      score: 0,
      indicators: [],
      error: error.message
    };
  }
};

/**
 * Generate revenue projections
 */
const generateRevenueProjection = async (ispId, months = 6) => {
  try {
    const projections = [];
    const currentDate = moment();

    // Get historical revenue data
    const historicalPayments = await Payment.findAll({
      where: {
        isp_id: ispId,
        status: 'completed',
        payment_date: {
          [Op.gte]: moment().subtract(12, 'months').toDate()
        }
      },
      attributes: [
        [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('payment_date'), '%Y-%m'), 'month'],
        [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total']
      ],
      group: [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('payment_date'), '%Y-%m')],
      raw: true
    });

    // Calculate average monthly revenue
    const monthlyTotals = historicalPayments.map(p => parseFloat(p.total || 0));
    const avgMonthlyRevenue = monthlyTotals.length > 0
      ? monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length
      : 0;

    // Get active customers
    const activeCustomers = await Customer.count({
      where: {
        isp_id: ispId,
        status: 'active'
      }
    });

    // Get average package price
    const packages = await Package.findAll({
      where: { isp_id: ispId },
      attributes: ['price']
    });
    const avgPackagePrice = packages.length > 0
      ? packages.reduce((sum, p) => sum + parseFloat(p.price || 0), 0) / packages.length
      : 0;

    // Generate projections
    for (let i = 1; i <= months; i++) {
      const projectionDate = moment(currentDate).add(i, 'months');
      const projectedRevenue = activeCustomers * avgPackagePrice;
      const growthRate = i <= 3 ? 0.05 : 0.02; // 5% growth first 3 months, 2% after
      const adjustedRevenue = projectedRevenue * (1 + growthRate * i);

      projections.push({
        month: projectionDate.format('YYYY-MM'),
        monthName: projectionDate.format('MMMM YYYY'),
        projectedRevenue: adjustedRevenue,
        activeCustomers: activeCustomers,
        avgPackagePrice: avgPackagePrice,
        confidence: i <= 3 ? 'high' : i <= 6 ? 'medium' : 'low'
      });
    }

    return {
      currentRevenue: avgMonthlyRevenue,
      activeCustomers: activeCustomers,
      avgPackagePrice: avgPackagePrice,
      projections: projections,
      growthRate: '2-5% monthly'
    };
  } catch (error) {
    console.error('Error generating revenue projection:', error);
    throw error;
  }
};

/**
 * Get high-risk customers list (sorted by churn risk)
 */
const getHighRiskCustomers = async (ispId, limit = 20) => {
  try {
    const customers = await Customer.findAll({
      where: {
        isp_id: ispId,
        status: { [Op.in]: ['active', 'inactive', 'suspended'] }
      },
      include: [
        { model: Bill, as: 'bills' },
        { model: Payment, as: 'payments' }
      ]
    });

    const riskScores = await Promise.all(
      customers.map(async (customer) => {
        const risk = await calculateChurnRisk(customer.id);
        return {
          customer: customer,
          risk: risk
        };
      })
    );

    // Sort by risk score (highest first)
    riskScores.sort((a, b) => b.risk.score - a.risk.score);

    return riskScores.slice(0, limit);
  } catch (error) {
    console.error('Error getting high-risk customers:', error);
    throw error;
  }
};

/**
 * Generate AI insights summary
 */
const generateInsights = async (ispId) => {
  try {
    const [
      highRiskCustomers,
      revenueProjection,
      totalCustomers,
      activeCustomers,
      overdueBills
    ] = await Promise.all([
      getHighRiskCustomers(ispId, 10),
      generateRevenueProjection(ispId, 6),
      Customer.count({ where: { isp_id: ispId } }),
      Customer.count({ where: { isp_id: ispId, status: 'active' } }),
      Bill.count({
        where: {
          isp_id: ispId,
          status: 'overdue'
        }
      })
    ]);

    return {
      timestamp: new Date(),
      summary: {
        totalCustomers,
        activeCustomers,
        inactiveCustomers: totalCustomers - activeCustomers,
        overdueBills
      },
      highRiskCustomers: highRiskCustomers.length,
      revenueProjection: revenueProjection,
      recommendations: [
        overdueBills > 0 ? `Take action on ${overdueBills} overdue bills` : null,
        highRiskCustomers.length > 0 ? `Monitor ${highRiskCustomers.length} high-risk customers` : null,
        'Review revenue projections and adjust packages if needed'
      ].filter(Boolean)
    };
  } catch (error) {
    console.error('Error generating insights:', error);
    throw error;
  }
};

module.exports = {
  calculateChurnRisk,
  detectFraud,
  generateRevenueProjection,
  getHighRiskCustomers,
  generateInsights
};

