import React, { useState } from 'react';
import { Employee } from '../types';
import { Search, Plus, X, Pencil, Trash2, Phone, Mail, User, DollarSign } from 'lucide-react';

interface EmployeeManagerProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
}

export const EmployeeManager: React.FC<EmployeeManagerProps> = ({
  employees,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
    baseRate: ''
  });

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.phone.includes(searchTerm)
  );

  const handleOpenEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setFormData({
      name: emp.name,
      role: emp.role,
      phone: emp.phone,
      email: emp.email || '',
      baseRate: emp.baseRate ? emp.baseRate.toString() : ''
    });
    setShowModal(true);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      role: '',
      phone: '',
      email: '',
      baseRate: ''
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.phone) {
      alert("Vui lòng nhập tên và số điện thoại.");
      return;
    }

    const employeeData: Employee = {
      id: editingId || `EMP-${Date.now()}`,
      name: formData.name,
      role: formData.role,
      phone: formData.phone,
      email: formData.email,
      baseRate: formData.baseRate ? Number(formData.baseRate) : 0,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`
    };

    if (editingId) {
      onUpdateEmployee(employeeData);
    } else {
      onAddEmployee(employeeData);
    }

    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Danh Mục Nhân Sự</h2>
        <button 
          onClick={handleOpenAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium shadow-sm"
        >
          <Plus size={16} /> Thêm Nhân Viên
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Tìm kiếm nhân viên theo tên, vai trò, SĐT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredEmployees.map(emp => (
          <div key={emp.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex gap-4 hover:shadow-md transition group relative">
             <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleOpenEdit(emp)} className="p-1.5 text-gray-400 hover:text-blue-600 bg-slate-50 rounded">
                  <Pencil size={16} />
                </button>
                <button 
                  onClick={() => { if(window.confirm('Xóa nhân viên này?')) onDeleteEmployee(emp.id); }} 
                  className="p-1.5 text-gray-400 hover:text-red-600 bg-slate-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
             </div>

             <img src={emp.avatarUrl} alt={emp.name} className="w-16 h-16 rounded-full object-cover border border-slate-200" />
             
             <div className="flex-1">
                <h3 className="font-bold text-gray-800 text-lg">{emp.name}</h3>
                <p className="text-blue-600 font-medium text-sm mb-2">{emp.role || 'Chưa có vị trí'}</p>
                
                <div className="space-y-1 text-sm text-gray-500">
                   <p className="flex items-center gap-2"><Phone size={14} /> {emp.phone}</p>
                   {emp.email && <p className="flex items-center gap-2"><Mail size={14} /> {emp.email}</p>}
                   {emp.baseRate && (
                     <p className="flex items-center gap-2 text-green-600 font-medium">
                       <DollarSign size={14} /> {emp.baseRate.toLocaleString()} đ/ngày
                     </p>
                   )}
                </div>
             </div>
          </div>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
         <div className="text-center py-20 text-gray-500">
           Không tìm thấy nhân viên nào.
         </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-gray-800">{editingId ? 'Sửa Thông Tin Nhân Viên' : 'Thêm Nhân Viên Mới'}</h3>
               <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                 <X size={24} />
               </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ và Tên</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí / Chuyên môn</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  placeholder="Kỹ thuật viên âm thanh"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                   <input 
                      type="text" 
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Email (Tùy chọn)</label>
                   <input 
                      type="email" 
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lương cơ bản gợi ý (VNĐ)</label>
                <input 
                  type="number" 
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.baseRate}
                  onChange={(e) => setFormData({...formData, baseRate: e.target.value})}
                  placeholder="500000"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm"
              >
                Lưu Thông Tin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
