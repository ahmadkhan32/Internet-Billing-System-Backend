const fs = require('fs');
const path = require('path');
const { ISP, User, Package, Customer, Bill, Payment } = require('../models');

/**
 * Generate SRS (Software Requirements Specification) file for a new business
 * @param {Object} businessData - Business information
 * @param {string} businessData.business_id - Unique business ID
 * @param {string} businessData.business_name - Business name
 * @param {string} businessData.email - Business admin email
 * @param {string} businessData.package - Package name (optional)
 * @returns {string} Path to generated SRS file
 */
const generateSRSFile = async (businessData) => {
  try {
    const { business_id, business_name, email, package: packageName } = businessData;
    
    // Create directory for business files
    const businessDir = path.join(__dirname, '..', 'uploads', 'businesses', business_id);
    if (!fs.existsSync(businessDir)) {
      fs.mkdirSync(businessDir, { recursive: true });
    }

    // Generate SRS content
    const srsContent = `# Software Requirements Specification (SRS)
## Business Management System

**Business Information:**
- Business ID: ${business_id}
- Business Name: ${business_name}
- Admin Email: ${email}
- Package: ${packageName || 'Not Assigned'}
- Created Date: ${new Date().toISOString().split('T')[0]}

---

## 1. System Overview

This document defines the software requirements for the **${business_name}** billing and customer management system. The system provides comprehensive billing, payment processing, customer management, and reporting capabilities.

---

## 2. System Modules

### 2.1 Customer Management
- Create, read, update, and delete customer records
- Customer portal access with minimum payment requirement (PKR 0.01)
- Customer status management (active, inactive, suspended, disconnected)
- Package assignment and data usage tracking

### 2.2 Billing System
- Automated bill generation based on customer packages
- Bill status tracking (pending, paid, partial, overdue, cancelled)
- Late fee calculation (5% if overdue)
- Invoice generation and download

### 2.3 Payment Processing
- Multiple payment methods:
  - Cash
  - Bank Transfer
  - JazzCash
  - EasyPaisa
  - PayPal
  - Stripe/Credit Card
- Payment approval workflow (Business Admin/Recovery Officer)
- Payment proof upload support
- Receipt generation

### 2.4 Payment Approval System
- All customer payments start as 'pending'
- Business Admin and Recovery Officer can approve payments
- Automatic bill status update upon approval
- Customer notification on approval

### 2.5 Loyalty Points System
- Customers earn 0.01 points per PKR paid
- Points awarded when payment is approved
- Points stored in customer record

### 2.6 Customer Portal
- Minimum payment requirement: PKR 0.01 to access portal
- View bills and payment history
- Make online payments
- Download invoices and receipts
- View account information and data usage

---

## 3. Database Structure

### 3.1 Core Tables
- **isps** (Businesses): Business information and subscription details
- **users**: System users (Super Admin, Business Admin, Staff, Customers)
- **customers**: Customer records linked to businesses
- **packages**: Service packages (speed, price, data limits)
- **bills**: Customer bills and invoices
- **payments**: Payment records with approval workflow
- **notifications**: System notifications
- **activity_logs**: Audit trail

### 3.2 Key Relationships
- Business (ISP) → Users (Admin, Staff)
- Business (ISP) → Customers
- Customers → Bills
- Bills → Payments
- Payments → Approval by Admin/Recovery Officer

---

## 4. Access Control

### 4.1 Super Admin
- Full CRUD on all businesses
- View all system data
- Manage SaaS packages
- System-wide analytics

### 4.2 Business Admin
- Manage own business customers, bills, and payments
- Approve customer payments
- View business analytics
- Manage staff users

### 4.3 Recovery Officer
- Approve customer payments
- View recovery records
- Update payment status

### 4.4 Customer
- Access portal (requires minimum PKR 0.01 payment)
- View own bills and payments
- Make payments
- Download invoices/receipts

---

## 5. Payment Workflow

1. **Customer creates payment** → Status: 'pending'
2. **Business Admin/Recovery Officer notified** → Email + In-app notification
3. **Admin/Recovery Officer approves** → Status: 'completed'
4. **Points awarded** → 0.01 points per PKR paid
5. **Bill status updated** → Based on total paid amount
6. **Customer notified** → Payment approved confirmation

---

## 6. Integration Points

### 6.1 Payment Gateways
- **Stripe**: Credit/Debit card payments
- **JazzCash**: Mobile wallet payments
- **EasyPaisa**: Mobile wallet payments
- **PayPal**: Online payments (optional)

### 6.2 Notification System
- Email notifications
- In-app notifications
- SMS notifications (optional)

### 6.3 Reporting
- Dashboard analytics
- Payment reports
- Customer reports
- Revenue reports

---

## 7. Default Data Seeded

When a business is created, the following default data is automatically generated:

1. **Admin User**: Created with business email
2. **Default Packages**: Can be assigned from SaaS packages
3. **File Structure**: Business-specific upload directories
4. **SRS Document**: This file

---

## 8. Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Multi-tenant data isolation
- Password encryption (bcrypt)
- Payment proof file uploads (secure storage)
- Activity logging for audit trail

---

## 9. Technical Stack

- **Backend**: Node.js, Express.js, Sequelize ORM
- **Database**: MySQL
- **Frontend**: React, Vite
- **Payment Processing**: Stripe, JazzCash APIs
- **File Storage**: Local filesystem (uploads directory)

---

## 10. Support & Maintenance

For technical support or questions:
- Contact: System Administrator
- Business ID: ${business_id}
- Created: ${new Date().toISOString()}

---

**Document Version**: 1.0
**Last Updated**: ${new Date().toISOString()}
**Status**: Active
`;

    // Write SRS file
    const srsFilePath = path.join(businessDir, 'SRS.md');
    fs.writeFileSync(srsFilePath, srsContent, 'utf8');
    
    console.log(`✅ Generated SRS file for business ${business_id}: ${srsFilePath}`);
    return srsFilePath;
  } catch (error) {
    console.error('Error generating SRS file:', error);
    throw error;
  }
};

/**
 * Seed default data for a new business
 * @param {Object} businessData - Business information
 * @param {number} ispId - ISP ID from database
 * @returns {Object} Seeded data summary
 */
const seedBusinessData = async (businessData, ispId) => {
  try {
    const { business_id, business_name } = businessData;
    const seededData = {
      packages: [],
      customers: 0,
      bills: 0,
      payments: 0
    };

    // Create default package templates (optional - can be skipped if packages are managed separately)
    // For now, we'll just log that seeding is available
    console.log(`📦 Data seeding available for business ${business_id} (ISP ID: ${ispId})`);
    console.log(`   Business can now create packages, customers, and bills through the admin panel.`);

    // Note: We don't auto-create packages/customers as they should be created by the business admin
    // But we can create a welcome/default package if needed
    
    return seededData;
  } catch (error) {
    console.error('Error seeding business data:', error);
    // Don't throw - seeding is optional
    return { packages: [], customers: 0, bills: 0, payments: 0 };
  }
};

/**
 * Create business directory structure
 * @param {string} businessId - Business ID
 * @returns {Object} Directory paths
 */
const createBusinessStructure = (businessId) => {
  try {
    const baseDir = path.join(__dirname, '..', 'uploads', 'businesses', businessId);
    const directories = {
      base: baseDir,
      invoices: path.join(baseDir, 'invoices'),
      receipts: path.join(baseDir, 'receipts'),
      paymentProofs: path.join(baseDir, 'payment-proofs'),
      documents: path.join(baseDir, 'documents')
    };

    // Create all directories
    Object.values(directories).forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    });

    return directories;
  } catch (error) {
    console.error('Error creating business structure:', error);
    throw error;
  }
};

module.exports = {
  generateSRSFile,
  seedBusinessData,
  createBusinessStructure
};

