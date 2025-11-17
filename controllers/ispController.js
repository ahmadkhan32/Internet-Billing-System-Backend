const { ISP } = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');

// @desc    Get all ISPs
// @route   GET /api/isps
// @access  Private (Super Admin only, or Admin can see their own ISP)
const getISPs = async (req, res) => {
  try {
    // Super admin can see all ISPs
    // Admin can only see their own ISP
    // Other roles cannot access this endpoint
    if (req.user.role === 'super_admin') {
      const isps = await ISP.findAll({
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'email', 'contact', 'subscription_status']
      });
      
      return res.json({
        success: true,
        count: isps.length,
        isps
      });
    } else if (req.user.role === 'admin' && req.user.isp_id) {
      // Admin can see their own ISP
      const isp = await ISP.findByPk(req.user.isp_id, {
        attributes: ['id', 'name', 'email', 'contact', 'subscription_status']
      });
      
      if (!isp) {
        return res.status(404).json({ message: 'ISP not found' });
      }
      
      return res.json({
        success: true,
        count: 1,
        isps: [isp]
      });
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }
  } catch (error) {
    console.error('Get ISPs error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single ISP by ID
// @route   GET /api/isps/:id
// @access  Private (Super Admin, or Admin can see their own ISP)
const getISP = async (req, res) => {
  try {
    const isp = await ISP.findByPk(req.params.id, {
      attributes: ['id', 'name', 'email', 'contact', 'address', 'subscription_status', 'subscription_plan']
    });

    if (!isp) {
      return res.status(404).json({ message: 'ISP not found' });
    }

    // Super admin can access any ISP
    // Admin can only access their own ISP
    if (req.user.role !== 'super_admin' && req.user.isp_id !== isp.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      success: true,
      isp
    });
  } catch (error) {
    console.error('Get ISP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getISPs,
  getISP
};

