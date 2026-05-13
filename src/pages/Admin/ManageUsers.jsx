import { useState, useEffect } from 'react';
import { useToastStore } from '../../store/toastStore';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Skeleton from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import { Search, Users, Edit3, Trash2, Building2 } from 'lucide-react';
import { safeFormat } from '../../lib/dateUtils';
import { CDM_DEPARTMENTS } from '../../lib/departments';

export default function ManageUsers() {
  const toast = useToastStore();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: '', role: '', department: '', student_id: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadUsers(); }, [search, roleFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = { limit: 50 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const { data } = await api.get('/users', { params });
      setUsers(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error('Failed to load users');
    } finally { setLoading(false); }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({ 
      full_name: u.full_name || '', 
      role: u.role || 'student', 
      department: u.department || '',
      student_id: u.student_id || '' 
    });
  };

  const handleStudentIdChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 7) val = val.slice(0, 7);
    if (val.length > 2) {
      val = val.slice(0, 2) + '-' + val.slice(2);
    }
    setEditForm({ ...editForm, student_id: val });
  };

  const handleUpdateUser = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await api.put(`/users/${editUser.id}`, editForm);
      toast.success(`Updated ${editForm.full_name} successfully`);
      setEditUser(null);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleDelete = async (user) => {
    if (!confirm(`Delete user ${user.full_name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      toast.success('User deleted');
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Manage Users</h1>
        <p className="text-gray-500 mt-1">{total} total users</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20">
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="organizer">Organizer</option>
          <option value="student">Student</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">User</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Student ID</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Department</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Joined</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{u.full_name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.student_id || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.department || '—'}</td>
                  <td className="px-6 py-4"><Badge variant={u.role} /></td>
                  <td className="px-6 py-4 text-sm text-gray-500">{safeFormat(u.created_at, 'MMM d, yyyy')}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-600 transition-colors">
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => handleDelete(u)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit User Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        {editUser && (
          <div className="space-y-4">
            <p className="text-gray-500 text-sm">Editing <strong>{editUser.email}</strong></p>

            <div className="grid grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1.5 col-span-2">
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Student ID */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Student ID</label>
                <input
                  type="text"
                  value={editForm.student_id}
                  onChange={handleStudentIdChange}
                  placeholder="00-00000"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                >
                  <option value="student">Student</option>
                  <option value="organizer">Organizer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {/* Department / Program Dropdown */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Department / Program</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 size={18} className="text-gray-400" />
                </div>
                <select
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full pl-10 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none"
                >
                  <option value="">Select program...</option>
                  {CDM_DEPARTMENTS.map((dept) => (
                    <optgroup key={dept.institute} label={dept.institute}>
                      {dept.programs.map((prog) => (
                        <option key={prog} value={prog}>{prog}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button onClick={handleUpdateUser} loading={saving}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
