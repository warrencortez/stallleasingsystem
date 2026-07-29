const Application = require('../models/Application');
const Stall = require('../models/Stall');
const Tenant = require('../models/Tenant');

/**
 * Get all applications
 * GET /api/v1/applications
 */
const getAllApplications = async (req, res) => {
    try {
        const { status, user_id, search } = req.query;
        const applications = await Application.findAll({ status, user_id, search });
        
        res.status(200).json({
            success: true,
            data: applications,
            count: applications.length
        });
    } catch (error) {
        console.error('Get applications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch applications.'
        });
    }
};

/**
 * Get a single application
 * GET /api/v1/applications/:id
 */
const getApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const application = await Application.findById(id);
        
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: application
        });
    } catch (error) {
        console.error('Get application error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch application.'
        });
    }
};

/**
 * Create a new stall application
 * POST /api/v1/applications
 */
const createApplication = async (req, res) => {
    try {
        const applicationData = req.body;
        
        // Validate required fields
        if (!applicationData.full_name || !applicationData.business_name) {
            return res.status(400).json({
                success: false,
                message: 'Full name and business name are required.'
            });
        }

        // Check if stall exists and is available
        if (applicationData.stall_id) {
            const stall = await Stall.findById(applicationData.stall_id);
            if (!stall) {
                return res.status(404).json({
                    success: false,
                    message: 'Stall not found.'
                });
            }
            if (stall.status !== 'available') {
                return res.status(400).json({
                    success: false,
                    message: 'Stall is not available for application.'
                });
            }
        }

        // ✅ Auto-set user_id from logged-in user
        applicationData.user_id = req.userId;

        const applicationId = await Application.create(applicationData);
        const application = await Application.findById(applicationId);

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully! 📝',
            data: application
        });
    } catch (error) {
        console.error('Create application error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit application.'
        });
    }
};

/**
 * Review application (approve/reject)
 * PATCH /api/v1/applications/:id/review
 */
const reviewApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        // Validate status
        const validStatuses = ['approved', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be: approved or rejected.'
            });
        }

        // Check if application exists
        const application = await Application.findById(id);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found.'
            });
        }

        if (application.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Application has already been reviewed.'
            });
        }

        // Update application status
        const updated = await Application.updateStatus(id, status, req.userId);
        if (!updated) {
            return res.status(400).json({
                success: false,
                message: 'Failed to review application.'
            });
        }

        // =============================================
        // ✅ FIXED: CREATE TENANT WHEN APPROVED
        // Now handles user_id: null properly
        // =============================================
        if (status === 'approved') {
            try {
                // Check if tenant already exists with this email
                const existingTenant = await Tenant.findByEmail(application.email);
                
                if (!existingTenant) {
                    // ✅ FIX: Create tenant even if user_id is null
                    const tenantData = {
                        user_id: application.user_id || null,  // Allow null
                        stall_id: application.stall_id,
                        name: application.full_name,
                        email: application.email,
                        phone: application.phone,
                        address: null,
                        business_name: application.business_name,
                        business_type: application.business_type,
                        status: 'active',
                        contract_start: new Date(),
                        contract_end: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
                    };

                    const tenantId = await Tenant.create(tenantData);
                    console.log(`✅ Tenant created with ID: ${tenantId}`);
                    
                    // Update stall status to occupied
                    if (application.stall_id) {
                        await Stall.updateStatus(application.stall_id, 'occupied');
                        console.log(`✅ Stall ${application.stall_id} updated to occupied`);
                    }
                } else {
                    console.log(`ℹ️ Tenant already exists for email: ${application.email}`);
                }
            } catch (error) {
                console.error('Error creating tenant:', error);
                // Don't fail the whole request, just log it
            }
        }

        // Add notes if provided
        if (notes) {
            await Application.update(id, { notes: `${application.notes || ''}\nReviewer notes: ${notes}` });
        }

        const updatedApplication = await Application.findById(id);

        res.status(200).json({
            success: true,
            message: `Application ${status} successfully! ✅`,
            data: updatedApplication
        });
    } catch (error) {
        console.error('Review application error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to review application.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get application statistics
 * GET /api/v1/applications/stats
 */
const getApplicationStats = async (req, res) => {
    try {
        const stats = await Application.getStats();
        
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get application stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch application statistics.'
        });
    }
};

/**
 * Delete an application
 * DELETE /api/v1/applications/:id
 */
const deleteApplication = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if application exists
        const application = await Application.findById(id);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found.'
            });
        }

        const deleted = await Application.delete(id);
        if (!deleted) {
            return res.status(400).json({
                success: false,
                message: 'Failed to delete application.'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Application deleted successfully! ✅'
        });
    } catch (error) {
        console.error('Delete application error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete application.'
        });
    }
};

module.exports = {
    getAllApplications,
    getApplication,
    createApplication,
    reviewApplication,
    getApplicationStats,
    deleteApplication
};