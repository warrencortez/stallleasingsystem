const Application = require('../models/Application');
const Stall = require('../models/Stall');
const Tenant = require('../models/Tenant');
const Notification = require('../models/Notification');
const { pool } = require('../config/database');

/**
 * Get all applications
 * GET /api/v1/applications
 */
const getAllApplications = async (req, res) => {
    try {
        let { status, user_id, search } = req.query;
        if ((req.userRole === 'tenant' || req.userRole === 'applicant') && !user_id) {
            user_id = req.userId;
        }
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
        // 1-TENANT-PER-STALL & AUTO-REJECT CASCADE
        // =============================================
        if (status === 'approved') {
            try {
                if (application.stall_id) {
                    // 1. Verify stall is not already occupied by another tenant
                    const currentStall = await Stall.findById(application.stall_id);
                    if (currentStall && currentStall.status === 'occupied') {
                        return res.status(400).json({
                            success: false,
                            message: 'This stall is already occupied by an active tenant. A stall can only have 1 tenant.'
                        });
                    }

                    // 2. Mark stall status as occupied
                    await Stall.updateStatus(application.stall_id, 'occupied');
                    console.log(`[Stall ${application.stall_id}] Status updated to OCCUPIED.`);

                    // 3. Create/Link Tenant record
                    const existingTenant = await Tenant.findByEmail(application.email);
                    if (!existingTenant) {
                        const tenantData = {
                            user_id: application.user_id || null,
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
                        console.log(`[Tenant Created] ID: ${tenantId}`);
                    } else {
                        await Tenant.update(existingTenant.id, {
                            stall_id: application.stall_id,
                            status: 'active'
                        });
                    }

                    // 4. AUTO-REJECT ALL OTHER PENDING APPLICATIONS FOR THIS STALL
                    const { pool } = require('../config/database');
                    const otherPendingResult = await pool.query(
                        `SELECT id, user_id, full_name, email 
                         FROM applications 
                         WHERE stall_id = $1 AND id != $2 AND status = 'pending'`,
                        [application.stall_id, id]
                    );

                    if (otherPendingResult.rows.length > 0) {
                        await pool.query(
                            `UPDATE applications 
                             SET status = 'rejected', 
                                 rejection_reason = 'Stall has been leased to an approved applicant.',
                                 notes = COALESCE(notes, '') || E'\\n[System Auto-Reject]: Stall occupied by another tenant.',
                                 reviewed_by = $1,
                                 reviewed_at = CURRENT_TIMESTAMP,
                                 updated_at = CURRENT_TIMESTAMP
                             WHERE stall_id = $2 AND id != $3 AND status = 'pending'`,
                            [req.userId, application.stall_id, id]
                        );
                        console.log(`[Cascade Auto-Reject] Rejected ${otherPendingResult.rows.length} competing application(s) for stall ${application.stall_id}`);

                        // 5. Send notification to each rejected applicant
                        const Notification = require('../models/Notification');
                        for (const rejectedApp of otherPendingResult.rows) {
                            if (rejectedApp.user_id) {
                                await Notification.create({
                                    user_id: rejectedApp.user_id,
                                    title: 'Stall Application Notice',
                                    message: `Your application for ${currentStall?.stall_number || 'Stall'} was not accepted because the stall has been leased to another approved applicant.`,
                                    type: 'application_rejected',
                                    link: '/stalls'
                                });
                            }
                        }
                    }

                    // 6. Send approval notification to approved applicant
                    let targetApplicantUserId = application.user_id;
                    if (!targetApplicantUserId && application.email) {
                        const userRes = await pool.query("SELECT id FROM users WHERE lower(email) = lower($1)", [application.email.trim()]);
                        targetApplicantUserId = userRes.rows[0]?.id;
                    }
                    if (!targetApplicantUserId && application.phone) {
                        const userPhoneRes = await pool.query("SELECT id FROM users WHERE phone = $1", [application.phone.trim()]);
                        targetApplicantUserId = userPhoneRes.rows[0]?.id;
                    }

                    console.log(`[Approval Debug] Application ${id} approved. targetApplicantUserId: ${targetApplicantUserId}, email: ${application.email}`);

                    if (targetApplicantUserId) {
                        await Notification.create({
                            user_id: targetApplicantUserId,
                            title: 'Application Approved! 🎉',
                            message: `Application approved! Congratulations, your application for Stall ${currentStall?.stall_number || ''} has been approved. Click here to check the details.`,
                            type: 'application_approved',
                            link: `/stalls?stall_id=${application.stall_id}`
                        });
                        console.log(`[Notification Created] Created application_approved notification for user ID: ${targetApplicantUserId}`);
                    }
                }
            } catch (error) {
                console.error('Error during application approval cascade:', error);
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