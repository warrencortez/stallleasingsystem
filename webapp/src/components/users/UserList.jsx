import React, { useState, useEffect } from 'react';
import { userAPI } from '../../api/endpoints';
import ConfirmModal from '../common/ConfirmModal';
import {
    FaUserCog,
    FaSearch,
    FaCheckCircle,
    FaTimesCircle,
    FaEdit,
    FaTrash,
    FaShieldAlt
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const UserList = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Edit modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [editForm, setEditForm] = useState({
        name: '',
        email: '',
        role: 'tenant',
        phone: '',
        is_active: true
    });

    useEffect(() => {
        loadUsers();
    }, [roleFilter]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const res = await userAPI.getAll(roleFilter ? { role: roleFilter } : {});
            if (res.data?.success) {
                setUsers(res.data.data || []);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            toast.error('Failed to load user accounts');
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (u) => {
        setSelectedUser(u);
        setEditForm({
            name: u.name,
            email: u.email,
            role: u.role,
            phone: u.phone || '',
            is_active: u.is_active
        });
        setShowEditModal(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await userAPI.update(selectedUser.id, editForm);
            if (res.data?.success) {
                toast.success('User updated successfully');
                setShowEditModal(false);
                loadUsers();
            }
        } catch (error) {
            toast.error('Failed to update user');
        }
    };

    const handleDeleteClick = (u) => {
        setDeleteTarget(u);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            setDeleting(true);
            const res = await userAPI.delete(deleteTarget.id);
            if (res.data?.success) {
                toast.success('User account deleted.');
                setDeleteTarget(null);
                loadUsers();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete user');
        } finally {
            setDeleting(false);
        }
    };

    const filteredUsers = users.filter((u) =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container-fluid p-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
                        <FaUserCog className="text-primary" /> User Accounts & Role Control
                    </h3>
                    <p className="text-muted mb-0">Manage system users, grant administrative permissions, and deactivate accounts.</p>
                </div>
            </div>

            {/* Filter */}
            <div className="modern-card p-3 mb-4">
                <div className="row g-3 align-items-center">
                    <div className="col-12 col-md-6">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0">
                                <FaSearch className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0 bg-light"
                                placeholder="Search by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="col-12 col-md-6 d-flex justify-content-md-end">
                        <select
                            className="form-select form-select-sm"
                            style={{ width: '180px' }}
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="">All Roles</option>
                            <option value="admin">Administrators</option>
                            <option value="staff">Staff Members</option>
                            <option value="tenant">Tenants / Owners</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="modern-card overflow-hidden">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th className="ps-4">Name / Contact</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th className="text-end pe-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-5 text-muted">
                                        <div className="spinner-border text-primary spinner-border-sm me-2"></div>
                                        Loading users...
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-5 text-muted">
                                        No users matching query.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.id}>
                                        <td className="ps-4">
                                            <div className="fw-bold text-dark">{u.name}</div>
                                            <div className="small text-muted">{u.phone || 'No phone'}</div>
                                        </td>
                                        <td>{u.email}</td>
                                        <td>
                                            <span className={`badge text-capitalize ${
                                                u.role === 'admin' ? 'bg-danger' : (u.role === 'staff' ? 'bg-primary' : 'bg-secondary')
                                            }`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td>
                                            {u.is_active ? (
                                                <span className="badge-status badge-available">Active</span>
                                            ) : (
                                                <span className="badge-status badge-overdue">Inactive</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="small text-muted">{new Date(u.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td className="text-end pe-4">
                                            <div className="d-flex justify-content-end gap-2">
                                                <button
                                                    className="btn btn-sm btn-outline-primary"
                                                    onClick={() => handleEditClick(u)}
                                                    title="Edit User"
                                                >
                                                    <FaEdit />
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => handleDeleteClick(u)}
                                                    title="Delete User"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Edit User */}
            {showEditModal && selectedUser && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow rounded-4">
                            <div className="modal-header bg-primary text-white p-3">
                                <h6 className="modal-title fw-bold">Edit User Account</h6>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowEditModal(false)}></button>
                            </div>
                            <form onSubmit={handleEditSubmit}>
                                <div className="modal-body p-4">
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Full Name</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            required
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Email Address</label>
                                        <input
                                            type="email"
                                            className="form-control"
                                            required
                                            value={editForm.email}
                                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Role</label>
                                            <select
                                                className="form-select"
                                                value={editForm.role}
                                                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                            >
                                                <option value="admin">Admin</option>
                                                <option value="staff">Staff</option>
                                                <option value="tenant">Tenant</option>
                                            </select>
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Contact Phone</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={editForm.phone}
                                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-check">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            id="activeCheck"
                                            checked={editForm.is_active}
                                            onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                                        />
                                        <label className="form-check-label small" htmlFor="activeCheck">
                                            Account is active and permitted to login
                                        </label>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light p-3">
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Professional Delete User Account Warning Modal */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                title={`Delete User Account: ${deleteTarget?.name}`}
                message="Are you sure you want to permanently delete this user account from the system?"
                type="danger"
                confirmText="Yes, Delete User"
                cancelText="Cancel"
                loading={deleting}
                details={[
                    'The user credentials, permissions, and direct login access will be immediately terminated.',
                    'This action cannot be undone.'
                ]}
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteTarget(null)}
            />
        </div>
    );
};

export default UserList;
