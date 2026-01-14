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
import { Search, UserCheck, UserX, Trash2, Users, Clock, CheckCircle, XCircle, Pencil, Save, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, X, Eye, EyeOff } from "lucide-react";
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
  const [selectedRegionFilter, setSelectedRegionFilter] = useState("all");
  const [selectedProvinceFilter, setSelectedProvinceFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, itemsPerPage]);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, debouncedSearch, statusFilter, sortConfig, itemsPerPage]);

  useEffect(() => {
    fetchAreas("region");
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      let query = `?page=${currentPage}&limit=${itemsPerPage}&sort=${sortConfig.key}&order=${sortConfig.direction}`;
      if (debouncedSearch) query += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (statusFilter) query += `&status=${encodeURIComponent(statusFilter)}`;

      const response = await api.get(`/users${query}`);
      const data = response.data;
      const usersData = data.users || [];
      
      const normalizedUsers = usersData.map(user => ({
        ...user,
        id: String(user._id || user.id)
      }));
      setUsers(normalizedUsers);
      setTotalUsers(data.total || normalizedUsers.length);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAreas = async (type = null, parentId = null, parentCode = null) => {
    try {
      // Don't fetch if all are null to avoid loading all 40,000+ areas
      if (!type && !parentId && !parentCode) return;

      let query = `?limit=500`; // Use a large enough limit for any single level
      if (type) query += `&type=${type}`;
      if (parentId) query += `&parent_id=${parentId}`;
      if (parentCode) query += `&parent_code=${parentCode}`;

      const response = await api.get(`/areas${query}`);
      const data = Array.isArray(response.data) ? response.data : (response.data.areas || []);
      
      const normalizedData = data.map((area) => ({
        ...area,
        id: String(area._id || area.id),
        type: area.type?.toLowerCase(),
        parent_id: area.parent_id ? (typeof area.parent_id === "object" ? String(area.parent_id?._id || area.parent_id?.id) : String(area.parent_id)) : ""
      }));
      
      setAreas(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const newData = normalizedData.filter(a => !existingIds.has(a.id));
        return [...prev, ...newData];
      });
    } catch (error) {
      console.error("Failed to load areas");
    }
  };

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

  const handleApprove = (user) => {
    setSelectedUser(user);
    setEditName(user.name || "");
    setEditEmail(user.email || "");
    setEditPassword("");
    setEditConfirmPassword("");
    // Normalize assigned_areas to be an array of string IDs
    const areaIds = (user.assigned_areas || []).map(area => 
      typeof area === 'object' ? (area._id || area.id) : String(area)
    );
    setSelectedAreas(areaIds);
    setSelectedRegionFilter("all");
    setSelectedProvinceFilter("all");
    setIsDialogOpen(true);
  };

  const confirmApproval = async (status) => {
    if (editPassword && editPassword !== editConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsUpdating(true);
    try {
      const updateData = {
        status,
        assigned_areas: selectedAreas,
        role: selectedUser.role,
        name: editName,
        email: editEmail,
      };

      if (editPassword) {
        updateData.password = editPassword;
      }

      await api.put(`/users/${selectedUser.id}/approve`, updateData);
      toast.success(`User updated successfully`);
      fetchUsers();
      setIsDialogOpen(false);
      setSelectedUser(null);
      setSelectedAreas([]);
      setEditName("");
      setEditEmail("");
      setEditPassword("");
      setEditConfirmPassword("");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update user");
    } finally {
      setIsUpdating(false);
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
    const id = String(areaId);
    setSelectedAreas((prev) =>
      prev.some(a => String(a) === id)
        ? prev.filter((a) => String(a) !== id)
        : [...prev, id]
    );
  };

  const getAreaName = (areaId) => {
    if (!areaId) return "-";
    // If it's already an object with a name, use it
    if (typeof areaId === 'object' && areaId.name) return areaId.name;
    
    // Search in the local areas state
    const area = areas.find(a => a.id === String(areaId) || a._id === String(areaId) || a.code === String(areaId));
    if (area) return area.name;

    // If not found in local areas, check if it's available in any of the users' assigned_areas (which are populated)
    for (const u of users) {
      const found = (u.assigned_areas || []).find(aa => 
        (typeof aa === 'object' && (aa._id === String(areaId) || aa.id === String(areaId)))
      );
      if (found && typeof found === 'object' && found.name) return found.name;
    }

    return areaId;
  };

  const handleExport = async () => {
    try {
      const toastId = toast.loading("Preparing export...");
      
      // Fetch all users with current filters but no pagination
      let query = `?limit=all&sort=${sortConfig.key}&order=${sortConfig.direction}`;
      if (debouncedSearch) query += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (statusFilter && statusFilter !== "all") query += `&status=${encodeURIComponent(statusFilter)}`;
      
      const response = await api.get(`/users${query}`);
      const allUsers = response.data.users || [];

      if (allUsers.length === 0) {
        toast.dismiss(toastId);
        toast.error("No data to export");
        return;
      }

      const exportData = allUsers.map(user => ({
        "Name": user.name,
        "Email": user.email,
        "Role": user.role,
        "Status": user.status,
        "Assigned Areas": (user.assigned_areas || []).map(area => typeof area === 'object' ? area.name : getAreaName(area)).join(", ")
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
      
      const wscols = [
        { wch: 25 }, // Name
        { wch: 30 }, // Email
        { wch: 15 }, // Role
        { wch: 15 }, // Status
        { wch: 50 }, // Assigned Areas
      ];
      worksheet["!cols"] = wscols;

      XLSX.writeFile(workbook, `users_list_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(toastId);
      toast.success(`Exported ${allUsers.length} users`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    }
  };

  // Sorting is now handled on the server side
  const filteredUsers = users;

  const currentUsers = filteredUsers;

  const getPaginationRange = () => {
    const delta = 1;
    const range = [];
    const left = currentPage - delta;
    const right = currentPage + delta;
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        if (l) {
          if (i - l === 2) {
            range.push(l + 1);
          } else if (i - l !== 1) {
            range.push("...");
          }
        }
        range.push(i);
        l = i;
      }
    }
    return range;
  };

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
            <div className="flex flex-col sm:flex-row gap-4 items-center">
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
              <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(v === "all" ? "all" : parseInt(v))}>
                <SelectTrigger className="w-full sm:w-32 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Rows" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="20">20 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="all">Show All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b dark:border-slate-800">
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            Users ({totalUsers})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && filteredUsers.length === 0 ? (
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
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-left pl-6"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center justify-start">
                        Name {getSortIcon("name")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden md:table-cell"
                      onClick={() => handleSort("email")}
                    >
                      <div className="flex items-center justify-center">
                        Email {getSortIcon("email")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden sm:table-cell"
                      onClick={() => handleSort("role")}
                    >
                      <div className="flex items-center justify-center">
                        Role {getSortIcon("role")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center justify-center">
                        Status {getSortIcon("status")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden lg:table-cell"
                      onClick={() => handleSort("assigned_areas")}
                    >
                      <div className="flex items-center justify-center">
                        Assigned Areas {getSortIcon("assigned_areas")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden xl:table-cell"
                      onClick={() => handleSort("createdAt")}
                    >
                      <div className="flex items-center justify-center">
                        Joined {getSortIcon("createdAt")}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="border-b dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/30">
                      <TableCell className="font-medium dark:text-slate-200 text-left pl-6">{user.name}</TableCell>
                      <TableCell className="dark:text-slate-300 text-center hidden md:table-cell">{user.email}</TableCell>
                      <TableCell className="capitalize dark:text-slate-300 text-center hidden sm:table-cell">
                        <div className="flex justify-center">
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
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          {getStatusBadge(user.status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center hidden lg:table-cell">
                        {user.assigned_areas && user.assigned_areas.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {user.assigned_areas.map((area) => {
                              const areaName = typeof area === 'object' ? area.name : getAreaName(area);
                              const areaId = typeof area === 'object' ? (area._id || area.id) : area;
                              return (
                                <span
                                  key={areaId}
                                  className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded border dark:border-slate-700"
                                >
                                  {areaName}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">-</span>
                        )}
                      </TableCell>
                      <TableCell className="dark:text-slate-300 text-xs whitespace-nowrap text-center hidden xl:table-cell">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
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

        {/* Pagination Footer */}
        {totalUsers > 0 && (
          <div className="px-6 py-4 border-t dark:border-slate-800 bg-stone-50/50 dark:bg-slate-800/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {itemsPerPage === "all" ? (
                <span>Showing all <span className="font-medium text-slate-700 dark:text-slate-200">{totalUsers}</span> users</span>
              ) : (
                <>
                  Showing <span className="font-medium text-slate-700 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, totalUsers)}</span> of{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{totalUsers}</span> users
                </>
              )}
            </div>
            
            {itemsPerPage !== "all" && totalPages > 1 && (
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 dark:bg-slate-900 dark:border-slate-700"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1">
                  {getPaginationRange().map((page, index) => (
                    page === "..." ? (
                      <span key={`dots-${index}`} className="px-2 text-slate-400">...</span>
                    ) : (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        className={`h-8 w-8 text-xs p-0 ${
                          currentPage === page 
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                          : "dark:bg-slate-900 dark:border-slate-700"
                        }`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    )
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 dark:bg-slate-900 dark:border-slate-700"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
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
              <div className="space-y-1">
                <Label className="text-xs dark:text-slate-400 font-medium">Full Name</Label>
                <Input 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter full name"
                  className="h-9 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs dark:text-slate-400 font-medium">Email Address</Label>
                <Input 
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Enter email"
                  type="email"
                  className="h-9 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs dark:text-slate-400 font-medium">New Password</Label>
                <div className="relative">
                  <Input 
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Leave blank to keep"
                    type={showEditPassword ? "text" : "password"}
                    className="h-9 pr-8 dark:bg-slate-900 dark:border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs dark:text-slate-400 font-medium">Confirm Password</Label>
                <div className="relative">
                  <Input 
                    value={editConfirmPassword}
                    onChange={(e) => setEditConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    type={showEditConfirmPassword ? "text" : "password"}
                    className="h-9 pr-8 dark:bg-slate-900 dark:border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showEditConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
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

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs dark:text-slate-400">Region</Label>
                  <Select value={selectedRegionFilter} onValueChange={(val) => {
                    setSelectedRegionFilter(val);
                    setSelectedProvinceFilter("all");
                    if (val !== "all") {
                      const regionObj = areas.find(a => a.id === val);
                      fetchAreas("province", val, regionObj?.code);
                    }
                  }}>
                    <SelectTrigger className="h-8 text-xs dark:bg-slate-900 dark:border-slate-700">
                      <SelectValue placeholder="Region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      {areas.filter(a => a.type === "region").map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs dark:text-slate-400">Province</Label>
                  <Select 
                    value={selectedProvinceFilter} 
                    onValueChange={(val) => {
                      setSelectedProvinceFilter(val);
                      if (val !== "all") {
                        const provinceObj = areas.find(a => a.id === val);
                        fetchAreas("municipality", val, provinceObj?.code);
                      }
                    }}
                    disabled={selectedRegionFilter === "all"}
                  >
                    <SelectTrigger className="h-8 text-xs dark:bg-slate-900 dark:border-slate-700">
                      <SelectValue placeholder="Province" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Provinces</SelectItem>
                      {areas.filter(a => a.type === "province" && a.parent_id === selectedRegionFilter).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="dark:text-slate-300">Assign Areas</Label>
                  <span className="text-xs text-slate-500">{selectedAreas.length} selected</span>
                </div>
                
                {/* Selected Areas Tags */}
                {selectedAreas.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                    {selectedAreas.map(areaId => (
                      <Badge 
                        key={areaId} 
                        variant="secondary" 
                        className="flex items-center gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                      >
                        {getAreaName(areaId)}
                        <X 
                          className="w-3 h-3 cursor-pointer hover:text-rose-500" 
                          onClick={() => toggleArea(areaId)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="max-h-60 overflow-y-auto border border-stone-200 dark:border-slate-800 rounded-lg p-3 space-y-2 bg-white dark:bg-slate-900/50 shadow-sm">
                  {areas.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-600">No areas available.</p>
                  ) : (
                    areas
                      .filter((area) => {
                        // Logic:
                        // 1. If nothing selected, show Regions
                        // 2. If Region selected, show its Provinces
                        // 3. If Province selected, show its Municipalities
                        // 4. If Municipality selected, show its Barangays
                        
                        if (selectedProvinceFilter !== "all") {
                          const p = areas.find(a => a.id === selectedProvinceFilter);
                          return area.type === "municipality" && (area.parent_id === selectedProvinceFilter || (p && area.parent_code === p.code));
                        }
                        if (selectedRegionFilter !== "all") {
                          const r = areas.find(a => a.id === selectedRegionFilter);
                          return area.type === "province" && (area.parent_id === selectedRegionFilter || (r && area.parent_code === r.code));
                        }
                        return area.type === "region";
                      })
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((area) => (
                        <div key={area.id} className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 p-1 rounded transition-colors">
                          <Checkbox
                            id={area.id}
                            checked={selectedAreas.includes(area.id)}
                            onCheckedChange={() => toggleArea(area.id)}
                            className="dark:border-slate-700"
                          />
                          <label htmlFor={area.id} className="text-sm cursor-pointer flex justify-between w-full dark:text-slate-300">
                            <span>{area.name}</span>
                            <span className="text-slate-400 dark:text-slate-500 text-xs">({area.type})</span>
                          </label>
                        </div>
                      ))
                  )}
                  {areas.length > 0 && areas.filter(area => {
                    if (selectedProvinceFilter !== "all") return area.parent_id === selectedProvinceFilter && area.type === "municipality";
                    if (selectedRegionFilter !== "all") return area.parent_id === selectedRegionFilter && area.type === "province";
                    return area.type === "region";
                  }).length === 0 && (
                    <p className="text-sm text-slate-400 dark:text-slate-600 text-center py-2">
                      No areas found for this selection.
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
                    disabled={isUpdating}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-stone-200 dark:border-slate-800 text-stone-600 dark:text-slate-400 hover:bg-stone-50 dark:hover:bg-slate-800"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isUpdating}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                    onClick={() => confirmApproval("approved")}
                    disabled={isUpdating}
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    {isUpdating ? "Approving..." : "Approve"}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => confirmApproval("rejected")}
                    disabled={isUpdating}
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    {isUpdating ? "Rejecting..." : "Reject"}
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
