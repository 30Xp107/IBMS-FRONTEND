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
  DialogTrigger,
  DialogFooter,
  DialogDescription
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Plus, Check, Loader2, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

const TravelOrdersPage = () => {
  const { api, user } = useAuth();
  const [travelOrders, setTravelOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  
  // Form State
  const [formData, setFormData] = useState({
    participants: [],
    date_from: null,
    date_to: null,
    destination: {
      region: "",
      province: "",
      municipality: ""
    },
    purpose: ""
  });

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTO, setSelectedTO] = useState(null);
  const [selectedApprover, setSelectedApprover] = useState("");
  
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewTO, setViewTO] = useState(null);

  useEffect(() => {
    fetchTravelOrders();
    fetchUsers();
    fetchRegions();
  }, []);

  useEffect(() => {
    if (formData.destination.region) {
      fetchProvinces(formData.destination.region);
    } else {
      setProvinces([]);
    }
  }, [formData.destination.region]);

  useEffect(() => {
    if (formData.destination.province) {
      fetchMunicipalities(formData.destination.province);
    } else {
      setMunicipalities([]);
    }
  }, [formData.destination.province]);

  const fetchTravelOrders = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/travel-orders");
      setTravelOrders(res.data);
    } catch (error) {
      console.error("Error fetching travel orders:", error);
      toast.error("Failed to load travel orders");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get("/travel-orders/users");
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchRegions = async () => {
    try {
      const res = await api.get("/travel-orders/regions");
      setRegions(res.data);
    } catch (error) {
      console.error("Error fetching regions:", error);
    }
  };

  const fetchProvinces = async (region) => {
    try {
      const res = await api.get(`/travel-orders/provinces?region=${encodeURIComponent(region)}`);
      setProvinces(res.data);
    } catch (error) {
      console.error("Error fetching provinces:", error);
    }
  };

  const fetchMunicipalities = async (province) => {
    try {
      const res = await api.get(`/travel-orders/municipalities?province=${encodeURIComponent(province)}`);
      setMunicipalities(res.data);
    } catch (error) {
      console.error("Error fetching municipalities:", error);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    try {
      // Validation
      if (!formData.date_from || !formData.date_to) {
        toast.error("Please select travel dates");
        return;
      }
      if (formData.date_to < formData.date_from) {
        toast.error("To Date cannot be earlier than From Date");
        return;
      }
      if (!formData.destination.region || !formData.destination.province || !formData.destination.municipality) {
        toast.error("Please select a destination");
        return;
      }
      if (!formData.purpose.trim()) {
        toast.error("Purpose is required");
        return;
      }

      setIsSubmitting(true);
      await api.post("/travel-orders", formData);
      toast.success("Travel Order Request created successfully");
      setIsDialogOpen(false);
      fetchTravelOrders();
      // Reset form
      setFormData({
        participants: [],
        date_from: null,
        date_to: null,
        destination: { region: "", province: "", municipality: "" },
        purpose: ""
      });
    } catch (error) {
      console.error("Error creating travel order:", error);
      toast.error(error.response?.data?.message || "Failed to create request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await api.patch(`/travel-orders/${id}/status`, { status });
      toast.success(`Travel Order ${status} successfully`);
      fetchTravelOrders();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(error.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this travel order?")) return;
    
    try {
      await api.delete(`/travel-orders/${id}`);
      toast.success("Travel order deleted successfully");
      fetchTravelOrders();
    } catch (error) {
      console.error("Error deleting travel order:", error);
      toast.error(error.response?.data?.message || "Failed to delete travel order");
    }
  };

  const handleAssignApprover = async () => {
    try {
      if (!selectedApprover) {
        toast.error("Please select an approver");
        return;
      }
      await api.patch(`/travel-orders/${selectedTO._id}/approver`, { approverId: selectedApprover });
      toast.success("Approver assigned successfully");
      setAssignDialogOpen(false);
      fetchTravelOrders();
    } catch (error) {
      console.error("Error assigning approver:", error);
      toast.error(error.response?.data?.message || "Failed to assign approver");
    }
  };

  const toggleParticipant = (userId) => {
    setFormData(prev => {
      const isSelected = prev.participants.includes(userId);
      if (isSelected) {
        return { ...prev, participants: prev.participants.filter(id => id !== userId) };
      } else {
        return { ...prev, participants: [...prev.participants, userId] };
      }
    });
  };

  return (
    <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Travel Orders</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Travel Order Request</DialogTitle>
                <DialogDescription>
                  Fill in the details for your travel request.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Participants */}
                <div className="grid gap-2">
                  <Label>Participants (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        {formData.participants.length > 0 
                          ? `${formData.participants.length} selected` 
                          : "Select participants"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <div className="p-2 border-b">
                        <p className="text-xs font-medium text-muted-foreground">Select users to include in this travel order</p>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto p-2">
                        {users.filter(u => u._id !== user._id).map(u => (
                          <div key={u._id} className="flex items-center space-x-2 p-2 hover:bg-accent rounded-sm">
                            <Checkbox 
                              id={`user-${u._id}`}
                              checked={formData.participants.includes(u._id)}
                              onCheckedChange={() => toggleParticipant(u._id)}
                            />
                            <Label htmlFor={`user-${u._id}`} className="flex-1 cursor-pointer">
                              {u.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>From Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.date_from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.date_from ? format(formData.date_from, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.date_from}
                          onSelect={(date) => setFormData({...formData, date_from: date})}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid gap-2">
                    <Label>To Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.date_to && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.date_to ? format(formData.date_to, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.date_to}
                          onSelect={(date) => setFormData({...formData, date_to: date})}
                          initialFocus
                          disabled={(date) => formData.date_from && date < formData.date_from}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Destination */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="grid gap-2 min-w-0">
                    <Label>Region</Label>
                    <Select 
                      onValueChange={(val) => setFormData(prev => ({ ...prev, destination: { region: val, province: "", municipality: "" } }))}
                      value={formData.destination.region}
                    >
                      <SelectTrigger className="w-full [&>span]:truncate overflow-hidden">
                        <SelectValue placeholder="Select Region" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map(r => (
                          <SelectItem key={r.code} value={r.name}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 min-w-0">
                    <Label>Province</Label>
                    <Select 
                      onValueChange={(val) => setFormData(prev => ({ ...prev, destination: { ...prev.destination, province: val, municipality: "" } }))}
                      value={formData.destination.province}
                      disabled={!formData.destination.region}
                    >
                      <SelectTrigger className="w-full [&>span]:truncate overflow-hidden">
                        <SelectValue placeholder="Select Province" />
                      </SelectTrigger>
                      <SelectContent>
                        {provinces.map(p => (
                          <SelectItem key={p.code} value={p.name}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 min-w-0">
                    <Label>Municipality/City</Label>
                    <Select 
                      onValueChange={(val) => setFormData(prev => ({ ...prev, destination: { ...prev.destination, municipality: val } }))}
                      value={formData.destination.municipality}
                      disabled={!formData.destination.province}
                    >
                      <SelectTrigger className="w-full [&>span]:truncate overflow-hidden">
                        <SelectValue placeholder="Select Municipality" />
                      </SelectTrigger>
                      <SelectContent>
                        {municipalities.map(m => (
                          <SelectItem key={m.code} value={m.name}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Purpose */}
                <div className="grid gap-2">
                  <Label>Purpose of Travel</Label>
                  <Textarea 
                    placeholder="Enter the purpose of your travel..."
                    value={formData.purpose}
                    onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Request History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Requested</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approver</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {travelOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4">No travel orders found.</TableCell>
                    </TableRow>
                  ) : (
                    travelOrders.map((to) => (
                      <TableRow key={to._id}>
                        <TableCell>{format(new Date(to.createdAt), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <div className="font-medium">{to.requester?.name}</div>
                          {to.participants?.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              + {to.participants.length} others
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(to.date_from), "MMM d")} - {format(new Date(to.date_to), "MMM d, yyyy")}
                          </div>
                        </TableCell>
                        <TableCell>
                          {to.destination.municipality}, {to.destination.province}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={to.purpose}>
                          {to.purpose}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            to.status === "approved" ? "success" : 
                            to.status === "rejected" ? "destructive" : "secondary"
                          }>
                            {to.status.charAt(0).toUpperCase() + to.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {to.approver ? to.approver.name : <span className="text-muted-foreground italic">Unassigned</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setViewTO(to);
                                setViewDialogOpen(true);
                              }}
                            >
                              View
                            </Button>
                            {/* Approver Actions - Only for assigned approver or admin */}
                            {to.status === 'pending' && (to.approver?._id === user._id || user.role === 'admin') && (
                              <>
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleStatusUpdate(to._id, "approved")}
                                >
                                  Approve
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => handleStatusUpdate(to._id, "rejected")}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {/* Delete Action - Requester (if pending), Approver, or Admin */}
                            {(to.requester?._id === user._id || to.approver?._id === user._id || user.role === 'admin') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                onClick={() => handleDelete(to._id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Assign Approver Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Approver</DialogTitle>
              <DialogDescription>
                Select an admin or authorized user to approve this request.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Label>Select Approver</Label>
              <Select onValueChange={setSelectedApprover} value={selectedApprover}>
                <SelectTrigger>
                  <SelectValue placeholder="Select User" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u._id} value={u._id}>{u.name} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAssignApprover}>Assign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Details Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Travel Order Details</DialogTitle>
            </DialogHeader>
            {viewTO && (
              <div className="grid gap-6 py-4">
                {/* Header Status Section */}
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      {viewTO.requester?.name}
                      <Badge variant="outline">{viewTO.requester?.role}</Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Requested on {format(new Date(viewTO.createdAt), "PPP")}
                    </p>
                  </div>
                  <Badge className="text-base px-4 py-1" variant={
                    viewTO.status === "approved" ? "success" : 
                    viewTO.status === "rejected" ? "destructive" : "secondary"
                  }>
                    {viewTO.status.toUpperCase()}
                  </Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Travel Dates</Label>
                      <p className="font-medium">
                        {format(new Date(viewTO.date_from), "PPP")} - {format(new Date(viewTO.date_to), "PPP")}
                      </p>
                    </div>
                    
                    <div>
                      <Label className="text-muted-foreground">Destination</Label>
                      <p className="font-medium text-lg">
                        {viewTO.destination.municipality}, {viewTO.destination.province}
                      </p>
                      {viewTO.destination.region && (
                        <p className="text-sm text-muted-foreground">
                          {viewTO.destination.region}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label className="text-muted-foreground">Approver</Label>
                      <div className="flex items-center gap-2 mt-1">
                        {viewTO.approver ? (
                          <>
                            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 flex items-center justify-center font-bold text-xs">
                              {viewTO.approver.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{viewTO.approver.name}</p>
                              <p className="text-xs text-muted-foreground">{viewTO.approver.email}</p>
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground italic">Pending Assignment</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Participants</Label>
                      {viewTO.participants && viewTO.participants.length > 0 ? (
                        <div className="mt-2 grid gap-2">
                          {viewTO.participants.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 rounded-md">
                              <div className="h-6 w-6 rounded-full bg-white dark:bg-slate-700 border flex items-center justify-center text-xs text-slate-900 dark:text-slate-100">
                                {p.name?.charAt(0)}
                              </div>
                              <span>{p.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic mt-1">No additional participants</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Purpose Section (Full Width) */}
                <div>
                  <Label className="text-muted-foreground">Purpose of Travel</Label>
                  <div className="mt-2 p-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
                    {viewTO.purpose}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
};

export default TravelOrdersPage;
