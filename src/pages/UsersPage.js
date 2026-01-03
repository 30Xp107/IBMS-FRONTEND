import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, UserCheck, UserX, Trash2, Users, Clock, CheckCircle, XCircle, Pencil, Save, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import * as XLSX from "xlsx";

const UsersPage = () => {
  const { api } = useAuth();
  const [users, setUsers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [selectedProvinceFilter, setSelectedProvinceFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });

  useEffect(() => {
    Promise.all([fetchUsers(), fetchAreas()]);
  }, []);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1" />;
    return sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get("/users");
      // Backend returns { success: true, countUser, user } where user is the array
      const usersData = Array.isArray(response.data) 
        ? response.data 
        : (response.data.user || response.data.users || []);
      // Normalize MongoDB _id to id for frontend compatibility
      const normalizedUsers = usersData.map(user => ({
        ...user,
        id: String(user._id || user.id)
      }));
      setUsers(normalizedUsers);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAreas = async () => {
    try {
      const response = await api.get("/areas");
      const normalizedAreas = response.data.map(area => ({
        ...area,
        id: String(area._id || area.id),
        parent_id: area.parent_id ? (typeof area.parent_id === "object" ? String(area.parent_id?._id || area.parent_id?.id) : String(area.parent_id)) : ""
      }));
      setAreas(normalizedAreas);
    } catch (error) {
      console.error("Failed to load areas");
    }
  };

  const handleApprove = (user) => {
    setSelectedUser(user);
    setSelectedAreas(user.assigned_areas || []);
    setSelectedProvinceFilter("all");
    setIsDialogOpen(true);
  };

  const confirmApproval = async (status) => {
    try {
      await api.put(`/users/${selectedUser.id}/approve`, {
        status,
        assigned_areas: selectedAreas,
        role: selectedUser.role,
      });
      toast.success(`User ${status === "approved" ? "approved" : "rejected"} successfully`);
      fetchUsers();
      setIsDialogOpen(false);
      setSelectedUser(null);
      setSelectedAreas([]);
    } catch (error) {
      toast.error("Failed to update user status");
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const userToUpdate = users.find(u => u.id === userId);
      await api.put(`/users/${userId}/approve`, {
        role: newRole,
        status: userToUpdate.status,
        assigned_areas: userToUpdate.assigned_areas,
      });
      toast.success("User role updated successfully");
      fetchUsers();
    } catch (error) {
      toast.error("Failed to update user role");
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.delete(`/users/${userId}`);
      toast.success("User deleted");
      fetchUsers();
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const toggleArea = (areaId) => {
    setSelectedAreas((prev) =>
      prev.includes(areaId)
        ? prev.filter((a) => a !== areaId)
        : [...prev, areaId]
    );
  };

  const getAreaName = (areaId) => {
    const area = areas.find(a => a.id === areaId);
    return area ? area.name : areaId;
  };

  const handleExport = () => {
    if (filteredUsers.length === 0) {
      toast.error("No data to export");
      return;
    }

    const exportData = filteredUsers.map(user => ({
      "Name": user.name,
      "Email": user.email,
      "Role": user.role,
      "Status": user.status,
      "Assigned Areas": (user.assigned_areas || []).map(id => getAreaName(id)).join(", ")
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    
    // Set column widths
    const wscols = [
      { wch: 25 }, // Name
      { wch: 30 }, // Email
      { wch: 15 }, // Role
      { wch: 15 }, // Status
      { wch: 50 }, // Assigned Areas
    ];
    worksheet["!cols"] = wscols;

    XLSX.writeFile(workbook, `users_list_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Users list exported successfully");
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? user.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const key = sortConfig.key;
    const direction = sortConfig.direction === "asc" ? 1 : -1;
    
    let aValue, bValue;

    if (key === "assigned_areas") {
      aValue = (a.assigned_areas || []).length;
      bValue = (b.assigned_areas || []).length;
    } else if (key === "createdAt") {
      aValue = new Date(a.createdAt).getTime();
      bValue = new Date(b.createdAt).getTime();
    } else {
      aValue = String(a[key] || "").toLowerCase();
      bValue = String(b[key] || "").toLowerCase();
    }

    if (aValue < bValue) return -1 * direction;
    if (aValue > bValue) return 1 * direction;
    return 0;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="badge-pending">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="badge-approved">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="badge-rejected">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">User Management</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Approve users and assign areas</p>
        </div>
        <div className="flex justify-end w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={handleExport}
            className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-400 text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
              />
            </div>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-48 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b dark:border-slate-800">
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            Users ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="spinner" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-100 dark:bg-slate-800/50 hover:bg-stone-100 dark:hover:bg-slate-800/50 border-b dark:border-slate-800">
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center">
                        Name {getSortIcon("name")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("email")}
                    >
                      <div className="flex items-center">
                        Email {getSortIcon("email")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("role")}
                    >
                      <div className="flex items-center">
                        Role {getSortIcon("role")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center">
                        Status {getSortIcon("status")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("assigned_areas")}
                    >
                      <div className="flex items-center">
                        Assigned Areas {getSortIcon("assigned_areas")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("createdAt")}
                    >
                      <div className="flex items-center">
                        Joined {getSortIcon("createdAt")}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="border-b dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/30">
                      <TableCell className="font-medium dark:text-slate-200">{user.name}</TableCell>
                      <TableCell className="dark:text-slate-300">{user.email}</TableCell>
                      <TableCell className="capitalize dark:text-slate-300">
                        <Select
                          value={user.role}
                          onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                        >
                          <SelectTrigger className="h-8 w-24 dark:bg-slate-900 dark:border-slate-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell>
                        {user.assigned_areas && user.assigned_areas.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.assigned_areas.map((areaId) => (
                              <span
                                key={areaId}
                                className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded border dark:border-slate-700"
                              >
                                {getAreaName(areaId)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">-</span>
                        )}
                      </TableCell>
                      <TableCell className="dark:text-slate-300 text-xs whitespace-nowrap">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className={user.status === 'approved' 
                              ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                              : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                            }
                            onClick={() => handleApprove(user)}
                            title={user.status === 'approved' ? "Edit User" : "Approve User"}
                          >
                            {user.status === 'approved' ? (
                              <Pencil className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                            onClick={() => handleDelete(user.id)}
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">
              {selectedUser?.status === "approved" ? "Edit User Permissions" : `Manage User: ${selectedUser?.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-stone-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">User</p>
                <p className="font-medium truncate dark:text-slate-200">{selectedUser?.name}</p>
              </div>
              <div className="p-3 bg-stone-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">Email</p>
                <p className="font-medium truncate text-xs dark:text-slate-200">{selectedUser?.email}</p>
              </div>
            </div>
            
            <div className="p-3 bg-stone-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-between border dark:border-slate-800">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Current Status</p>
                {selectedUser && getStatusBadge(selectedUser.status)}
              </div>
              {selectedUser?.status === "approved" && (
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                  Editable Mode
                </Badge>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="dark:text-slate-300">Filter by Province</Label>
                <Select value={selectedProvinceFilter} onValueChange={setSelectedProvinceFilter}>
                  <SelectTrigger className="w-full bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="All Provinces" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                    <SelectItem value="all">All Provinces</SelectItem>
                    {areas
                        .filter((p) => p.type?.toLowerCase() === "province")
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="dark:text-slate-300">Assign Areas</Label>
                <div className="max-h-60 overflow-y-auto border border-stone-200 dark:border-slate-800 rounded-lg p-3 space-y-2 bg-white dark:bg-slate-900/50 shadow-sm">
                  {areas.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-600">No areas available. Create areas first.</p>
                  ) : (
                    areas
                      .filter((area) => {
                        const type = area.type?.toLowerCase();
                        
                        // If no province filter, only show provinces to keep it clean (Province first)
                        if (selectedProvinceFilter === "all") {
                          return type === "province";
                        }
                        
                        // If a province is selected, show its municipalities and their barangays
                        if (area.parent_id === selectedProvinceFilter) return true;
                        
                        // Also show barangays if their parent municipality is in the selected province
                        if (type === "barangay") {
                          const parentMunicipality = areas.find(a => a.id === area.parent_id);
                          return parentMunicipality && parentMunicipality.parent_id === selectedProvinceFilter;
                        }

                        return false;
                      })
                      .sort((a, b) => {
                        // Sort by type: province -> municipality -> barangay
                        const order = { province: 0, municipality: 1, barangay: 2 };
                        return order[a.type] - order[b.type];
                      })
                      .map((area) => (
                        <div key={area.id} className={`flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 p-1 rounded transition-colors ${area.type === 'barangay' ? 'ml-6' : area.type === 'municipality' ? 'ml-3' : ''}`}>
                          <Checkbox
                            id={area.id}
                            checked={selectedAreas.includes(area.id)}
                            onCheckedChange={() => toggleArea(area.id)}
                            className="dark:border-slate-700"
                          />
                          <label htmlFor={area.id} className="text-sm cursor-pointer flex justify-between w-full dark:text-slate-300">
                            <span className={area.type === 'province' ? 'font-bold' : area.type === 'municipality' ? 'font-semibold' : ''}>
                              {area.name}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 text-xs">({area.type})</span>
                          </label>
                        </div>
                      ))
                  )}
                  {areas.length > 0 && areas.filter(area => {
                    const type = area.type?.toLowerCase();
                    if (selectedProvinceFilter === "all") return type === "province";
                    return area.parent_id === selectedProvinceFilter || (
                      type === "barangay" && areas.find(m => m.id === area.parent_id)?.parent_id === selectedProvinceFilter
                    );
                  }).length === 0 && (
                    <p className="text-sm text-slate-400 dark:text-slate-600 text-center py-2">
                      {selectedProvinceFilter === "all" ? "No provinces found." : "No municipalities found for this province."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t dark:border-slate-800">
              {selectedUser?.status === "approved" ? (
                <>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => confirmApproval("approved")}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-stone-200 dark:border-slate-800 text-stone-600 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-800"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                    onClick={() => confirmApproval("approved")}
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => confirmApproval("rejected")}
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
