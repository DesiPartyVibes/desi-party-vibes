import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetAdminStats, 
  useAdminListVendors, 
  useAdminListUsers, 
  useAdminListBookings,
  useGetCurrentUser,
  useUpdateBookingStatus,
  useCreateVendor,
  useUpdateVendor,
  useDeleteVendor,
  useListCategories,
  useAdminVerifyVendor
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { LayoutDashboard, Users, Store, CalendarRange, Plus, Edit2, Trash2 } from "lucide-react";

const vendorSchema = z.object({
  name: z.string().min(2),
  categoryId: z.coerce.number().min(1),
  city: z.string().min(2),
  state: z.string().min(2),
  description: z.string().min(10),
  longDescription: z.string().optional(),
  priceMin: z.coerce.number().min(0),
  priceMax: z.coerce.number().min(0),
  imageUrl: z.string().url(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  isFeatured: z.boolean().default(false),
});

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: stats } = useGetAdminStats({ query: { enabled: user?.role === 'admin' } });
  const { data: vendors, refetch: refetchVendors } = useAdminListVendors({ query: { enabled: user?.role === 'admin' } });
  const { data: users, refetch: refetchUsers } = useAdminListUsers({ query: { enabled: user?.role === 'admin' } });
  const { data: bookings, refetch: refetchBookings } = useAdminListBookings({ query: { enabled: user?.role === 'admin' } });
  const { data: categories } = useListCategories();

  const updateStatus = useUpdateBookingStatus();
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();
  const verifyVendor = useAdminVerifyVendor();

  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<number | null>(null);

  const vendorForm = useForm<z.infer<typeof vendorSchema>>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: "",
      categoryId: 1,
      city: "",
      state: "",
      description: "",
      longDescription: "",
      priceMin: 0,
      priceMax: 0,
      imageUrl: "",
      phone: "",
      email: "",
      website: "",
      isFeatured: false,
    },
  });

  if (!userLoading && user?.role !== 'admin') {
    setLocation("/");
    return null;
  }

  if (userLoading) return null;

  const handleStatusChange = (id: number, status: string) => {
    updateStatus.mutate(
      { id, data: { status: status as any } },
      {
        onSuccess: () => {
          toast({ description: "Status updated" });
          refetchBookings();
        }
      }
    );
  };

  const onVendorSubmit = (values: z.infer<typeof vendorSchema>) => {
    const data = { ...values, email: values.email || undefined, website: values.website || undefined };
    if (editingVendorId) {
      updateVendor.mutate(
        { id: editingVendorId, data },
        {
          onSuccess: () => {
            toast({ description: "Vendor updated" });
            setIsVendorModalOpen(false);
            refetchVendors();
          }
        }
      );
    } else {
      createVendor.mutate(
        { data },
        {
          onSuccess: () => {
            toast({ description: "Vendor created" });
            setIsVendorModalOpen(false);
            refetchVendors();
          }
        }
      );
    }
  };

  const openEditModal = (vendor: any) => {
    setEditingVendorId(vendor.id);
    vendorForm.reset({
      name: vendor.name,
      categoryId: vendor.categoryId,
      city: vendor.city,
      state: vendor.state,
      description: vendor.description,
      longDescription: vendor.longDescription || "",
      priceMin: vendor.priceMin,
      priceMax: vendor.priceMax,
      imageUrl: vendor.imageUrl,
      phone: vendor.phone || "",
      email: vendor.email || "",
      website: vendor.website || "",
      isFeatured: vendor.isFeatured || false,
    });
    setIsVendorModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingVendorId(null);
    vendorForm.reset({
      name: "",
      categoryId: categories?.[0]?.id || 1,
      city: "",
      state: "",
      description: "",
      longDescription: "",
      priceMin: 0,
      priceMax: 0,
      imageUrl: "",
      phone: "",
      email: "",
      website: "",
      isFeatured: false,
    });
    setIsVendorModalOpen(true);
  };

  const handleVerifyVendor = (id: number) => {
    verifyVendor.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ description: "Vendor approved" });
          refetchUsers();
        }
      }
    );
  };

  const handleDeleteVendor = (id: number) => {
    if (confirm("Are you sure you want to delete this vendor?")) {
      deleteVendor.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ description: "Vendor deleted" });
            refetchVendors();
          }
        }
      );
    }
  };

  return (
    <Layout>
      <div className="bg-slate-900 text-white py-8">
        <div className="container mx-auto px-4 flex items-center gap-3">
          <LayoutDashboard className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-serif font-bold">Admin Dashboard</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Vendors</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{stats.totalVendors}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{stats.totalUsers}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Bookings</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{stats.totalBookings}</div></CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-800 dark:text-amber-500">Pending Bookings</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold text-amber-600 dark:text-amber-500">{stats.pendingBookings}</div></CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="vendors">
          <TabsList className="mb-6">
            <TabsTrigger value="vendors" className="gap-2"><Store className="h-4 w-4"/> Vendors</TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4"/> Users</TabsTrigger>
            <TabsTrigger value="bookings" className="gap-2"><CalendarRange className="h-4 w-4"/> Bookings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="vendors">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Manage Vendors</CardTitle>
                <Dialog open={isVendorModalOpen} onOpenChange={setIsVendorModalOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openCreateModal}><Plus className="h-4 w-4 mr-2" /> Add Vendor</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingVendorId ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
                    </DialogHeader>
                    <Form {...vendorForm}>
                      <form onSubmit={vendorForm.handleSubmit(onVendorSubmit)} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={vendorForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}
                          />
                          <FormField
                            control={vendorForm.control}
                            name="categoryId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value.toString()}>
                                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={vendorForm.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}
                          />
                          <FormField
                            control={vendorForm.control}
                            name="state"
                            render={({ field }) => (
                              <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}
                          />
                          <FormField
                            control={vendorForm.control}
                            name="priceMin"
                            render={({ field }) => (
                              <FormItem><FormLabel>Min Price ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )}
                          />
                          <FormField
                            control={vendorForm.control}
                            name="priceMax"
                            render={({ field }) => (
                              <FormItem><FormLabel>Max Price ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={vendorForm.control}
                          name="imageUrl"
                          render={({ field }) => (
                            <FormItem><FormLabel>Image URL</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )}
                        />
                        <FormField
                          control={vendorForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem><FormLabel>Short Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                          )}
                        />
                        <FormField
                          control={vendorForm.control}
                          name="longDescription"
                          render={({ field }) => (
                            <FormItem><FormLabel>Long Description</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>
                          )}
                        />
                        <div className="grid grid-cols-3 gap-4">
                          <FormField control={vendorForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={vendorForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={vendorForm.control} name="website" render={({ field }) => (<FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField
                          control={vendorForm.control}
                          name="isFeatured"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Featured Vendor</FormLabel>
                              </div>
                              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={createVendor.isPending || updateVendor.isPending}>
                          {editingVendorId ? "Update Vendor" : "Create Vendor"}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors?.map(v => (
                    <TableRow key={v.id}>
                      <TableCell>{v.id}</TableCell>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell><Badge variant="outline">{v.categoryName}</Badge></TableCell>
                      <TableCell>{v.city}, {v.state}</TableCell>
                      <TableCell>
                        <Badge variant={v.isActive ? "default" : "secondary"}>{v.isActive ? "Active" : "Inactive"}</Badge>
                        {v.isFeatured && <Badge className="ml-2 bg-purple-500 hover:bg-purple-600">Featured</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(v)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteVendor(v.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
          
          <TabsContent value="users">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>{u.id}</TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? "destructive" : u.role === 'vendor' ? "default" : "secondary"}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.role === 'vendor' && (
                          <Badge variant={u.isVerified ? "default" : "outline"}>
                            {u.isVerified ? "Verified" : "Pending"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{format(new Date(u.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-right">
                        {u.role === 'vendor' && !u.isVerified && (
                          <Button
                            size="sm"
                            onClick={() => handleVerifyVendor(u.id)}
                            disabled={verifyVendor.isPending}
                          >
                            Approve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
          
          <TabsContent value="bookings">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Event Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings?.map(b => (
                    <TableRow key={b.id}>
                      <TableCell>{b.id}</TableCell>
                      <TableCell className="font-medium">{b.vendorName}</TableCell>
                      <TableCell>{b.userName}</TableCell>
                      <TableCell>{format(new Date(b.eventDate), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant={b.status === 'pending' ? 'outline' : b.status === 'confirmed' ? 'default' : 'secondary'}>
                          {b.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select defaultValue={b.status} onValueChange={(val) => handleStatusChange(b.id, val)}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
