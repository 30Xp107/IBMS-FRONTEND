import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, User, Mail, Lock, ShieldCheck, Eye, EyeOff, Calendar as CalendarIcon, Plus, Trash2, PenTool, RefreshCw, Database } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const SettingsPage = () => {
  const { user, api, refreshUser, isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isFrmLoading, setIsFrmLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [frmSchedules, setFrmSchedules] = useState([]);
  const [isFrmDialogOpen, setIsFrmDialogOpen] = useState(false);
  const [isSignatoryLoading, setIsSignatoryLoading] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculationProgress, setRecalculationProgress] = useState({
    processed: 0,
    total: 0,
    updates: 0,
    is_running: false
  });
  const [signatory, setSignatory] = useState("");
  const [users, setUsers] = useState([]);
  const [currentFrm, setCurrentFrm] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });

  const fetchFrmSchedules = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get("/system-configs/frm_schedules");
      if (response.data && response.data.value) {
        setFrmSchedules(response.data.value);
      }
    } catch (error) {
      console.error("Failed to fetch FRM schedules:", error);
    }
  }, [api, isAdmin]);

  const fetchSignatory = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get("/system-configs/travel_order_signatory");
      if (response.data && response.data.value) {
        setSignatory(response.data.value);
      }
    } catch (error) {
      console.error("Failed to fetch signatory:", error);
    }
  }, [api, isAdmin]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get("/travel-orders/users");
      setUsers(response.data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, [api, isAdmin]);

  useEffect(() => {
    fetchFrmSchedules();
    fetchSignatory();
    fetchUsers();
  }, [fetchFrmSchedules, fetchSignatory, fetchUsers]);

  // Polling for recalculation status
  useEffect(() => {
    let interval;
    const checkStatus = async () => {
      try {
        const response = await api.get("/beneficiaries/maintenance/recalculate-status");
        setRecalculationProgress(response.data);
        if (response.data.is_running) {
          setIsRecalculating(true);
        } else if (isRecalculating) {
          setIsRecalculating(false);
          toast.success(`Recalculation complete: ${response.data.updates} statuses updated`);
        }
      } catch (error) {
        console.error("Failed to check recalculation status:", error);
      }
    };

    // Initial check on mount
    checkStatus();

    if (isRecalculating) {
      interval = setInterval(checkStatus, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [api, isRecalculating]);

  const handleSaveFrmSchedule = async () => {
    if (!currentFrm.name || !currentFrm.startDate || !currentFrm.endDate) {
      return toast.error("Please fill in all fields");
    }

    setIsFrmLoading(true);
    try {
      const existingScheduleIndex = frmSchedules.findIndex(s => s.name === currentFrm.name);
      let newSchedules;
      
      if (existingScheduleIndex > -1) {
        newSchedules = [...frmSchedules];
        newSchedules[existingScheduleIndex] = currentFrm;
      } else {
        newSchedules = [...frmSchedules, currentFrm].sort((a, b) => {
          const numA = parseInt(a.name.replace(/\D/g, ''));
          const numB = parseInt(b.name.replace(/\D/g, ''));
          return numA - numB;
        });
      }

      await api.put("/system-configs/frm_schedules", {
        value: newSchedules,
        description: "Custom FRM schedules with date ranges"
      });
      
      setFrmSchedules(newSchedules);
      setIsFrmDialogOpen(false);
      setCurrentFrm({ name: "", startDate: "", endDate: "" });
      toast.success("FRM schedule saved successfully");
    } catch (error) {
      toast.error("Failed to save FRM schedule");
    } finally {
      setIsFrmLoading(false);
    }
  };

  const handleUpdateSignatory = async (newSignatoryId) => {
    setIsSignatoryLoading(true);
    try {
      await api.put("/system-configs/travel_order_signatory", { value: newSignatoryId });
      setSignatory(newSignatoryId);
      toast.success("Travel Order Signatory updated successfully");
    } catch (error) {
      console.error("Failed to update signatory:", error);
      toast.error("Failed to update signatory");
    } finally {
      setIsSignatoryLoading(false);
    }
  };

  const handleRecalculateStatuses = async () => {
    setIsRecalculating(true);
    try {
      const response = await api.post("/beneficiaries/maintenance/recalculate-status");
      if (response.status === 202) {
        toast.info(response.data.message, { duration: 4000 });
      }
    } catch (error) {
      console.error("Failed to recalculate statuses:", error);
      toast.error(error.response?.data?.message || "Failed to recalculate statuses");
      setIsRecalculating(false);
    }
  };

  const deleteFrmSchedule = async (name) => {
    const newSchedules = frmSchedules.filter(s => s.name !== name);
    try {
      await api.put("/system-configs/frm_schedules", {
        value: newSchedules
      });
      setFrmSchedules(newSchedules);
      toast.success("FRM schedule removed");
    } catch (error) {
      toast.error("Failed to remove FRM schedule");
    }
  };

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name || "",
        email: user.email || "",
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const updateData = {
        name: formData.name,
        email: formData.email,
      };

      await api.put(`/auth/update-user/${user.id}`, updateData);
      toast.success("Profile updated successfully");
      if (refreshUser) await refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      return toast.error("New passwords do not match");
    }

    setIsLoading(true);
    try {
      await api.put(`/auth/update-user/${user.id}`, {
        password: formData.newPassword,
      });
      toast.success("Password updated successfully");
      setFormData((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-1 text-center sm:text-left">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">Account Settings</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Manage your personal information and security preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Section */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-stone-200 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your name and email address</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter your full name"
                      className="pl-10 dark:bg-slate-900 dark:border-slate-700"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Enter your email address"
                      className="pl-10 dark:bg-slate-900 dark:border-slate-700"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-stone-200 dark:border-slate-800 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-600" />
                Change Password
              </CardTitle>
              <CardDescription>Ensure your account is using a long, random password to stay secure</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={formData.newPassword}
                      onChange={handleChange}
                      placeholder="Enter new password"
                      className="pl-10 pr-10 dark:bg-slate-900 dark:border-slate-700"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm new password"
                      className="pl-10 pr-10 dark:bg-slate-900 dark:border-slate-700"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    variant="outline"
                    className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-900/20"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {isLoading ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {isAdmin && (
            <>
              <Card className="border-stone-200 dark:border-slate-800 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-amber-600" />
                    Travel Order Signatory
                  </CardTitle>
                  <CardDescription>Select the default signatory for all new travel orders</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Default Signatory</Label>
                    <Select 
                      value={signatory} 
                      onValueChange={handleUpdateSignatory}
                      disabled={isSignatoryLoading}
                    >
                      <SelectTrigger className="w-full dark:bg-slate-900 dark:border-slate-700">
                        <SelectValue placeholder="Select an official signatory" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u._id} value={u._id}>
                            {u.name} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-stone-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-indigo-600" />
                      FRM Schedules
                    </CardTitle>
                    <CardDescription>Set custom date ranges for FRM periods</CardDescription>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900/50 dark:hover:bg-indigo-900/20"
                    onClick={() => {
                      setCurrentFrm({ name: `FRM ${frmSchedules.length + 1}`, startDate: "", endDate: "" });
                      setIsFrmDialogOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Period
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {frmSchedules.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic py-2">No custom schedules defined yet.</p>
                    ) : (
                      <div className="grid gap-3">
                        {frmSchedules.map((schedule) => (
                          <div key={schedule.name} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            <div>
                              <p className="font-medium text-slate-700 dark:text-slate-200">{schedule.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {format(new Date(schedule.startDate), "MMM d")} - {format(new Date(schedule.endDate), "MMM d, yyyy")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                                onClick={() => {
                                  setCurrentFrm(schedule);
                                  setIsFrmDialogOpen(true);
                                }}
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                onClick={() => deleteFrmSchedule(schedule.name)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-stone-200 dark:border-slate-800 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    Data Maintenance
                  </CardTitle>
                  <CardDescription>Perform system-wide data cleanup and recalculations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-4 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Recalculate Beneficiary Statuses</p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">Scans all beneficiaries and updates status based on latest validation rules (HHID, Birthdate, etc.)</p>
                      </div>
                      <Button 
                        onClick={handleRecalculateStatuses} 
                        disabled={isRecalculating}
                        variant="outline"
                        className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
                      >
                        {isRecalculating ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            {recalculationProgress.total > 0 
                              ? `${Math.round((recalculationProgress.processed / recalculationProgress.total) * 100)}%` 
                              : "Running..."
                            }
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Run Now
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {isRecalculating && recalculationProgress.total > 0 && (
                      <div className="space-y-2">
                        <div className="w-full bg-blue-200/50 dark:bg-blue-900/50 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-blue-600 h-full transition-all duration-500" 
                            style={{ width: `${(recalculationProgress.processed / recalculationProgress.total) * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wider">
                          <span>Processed: {recalculationProgress.processed.toLocaleString()} / {recalculationProgress.total.toLocaleString()}</span>
                          <span>Updates: {recalculationProgress.updates.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          <Dialog open={isFrmDialogOpen} onOpenChange={setIsFrmDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Set FRM Schedule</DialogTitle>
                <DialogDescription>
                  Define the start and end dates for this FRM period.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="frm-name">FRM Name</Label>
                  <Input 
                    id="frm-name" 
                    placeholder="e.g. FRM 1" 
                    value={currentFrm.name}
                    onChange={(e) => setCurrentFrm({ ...currentFrm, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input 
                      id="start-date" 
                      type="date" 
                      value={currentFrm.startDate}
                      onChange={(e) => setCurrentFrm({ ...currentFrm, startDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="end-date">End Date</Label>
                    <Input 
                      id="end-date" 
                      type="date" 
                      value={currentFrm.endDate}
                      onChange={(e) => setCurrentFrm({ ...currentFrm, endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsFrmDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleSaveFrmSchedule} 
                  disabled={isFrmLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isFrmLoading ? "Saving..." : "Save Schedule"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="border-stone-200 dark:border-slate-800 shadow-sm bg-emerald-50/30 dark:bg-emerald-900/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Account Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Role</p>
                <p className="text-sm font-medium capitalize text-slate-700 dark:text-slate-200">{user?.role || "User"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Account ID</p>
                <p className="text-xs font-mono text-slate-700 dark:text-slate-200 truncate">{user?.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
