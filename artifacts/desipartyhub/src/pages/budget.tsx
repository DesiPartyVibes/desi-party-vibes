import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useGetBudgetPlan, 
  useUpsertBudgetPlan, 
  useCreateBudgetItem, 
  useUpdateBudgetItem, 
  useDeleteBudgetItem,
  useGetCurrentUser 
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Plus, Trash2, Edit2 } from "lucide-react";

const CATEGORIES = ["Venue", "Catering", "Decor", "Entertainment", "Photography", "Attire", "Jewelry", "Misc"];

export default function Budget() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: budget, isLoading: budgetLoading, refetch } = useGetBudgetPlan({ query: { enabled: !!user } });
  
  const upsertBudget = useUpsertBudgetPlan();
  const createItem = useCreateBudgetItem();
  const updateItem = useUpdateBudgetItem();
  const deleteItem = useDeleteBudgetItem();

  const [totalBudgetStr, setTotalBudgetStr] = useState("");
  const [eventName, setEventName] = useState("My Wedding");
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", category: "Venue", estimatedCost: "", actualCost: "" });

  useEffect(() => {
    if (budget) {
      setTotalBudgetStr(budget.totalBudget.toString());
      setEventName(budget.eventName);
    }
  }, [budget]);

  if (!userLoading && !user) {
    setLocation("/login");
    return null;
  }
  
const handleUpdateBudgetSettings = () => {
  upsertBudget.mutate(
    { data: { totalBudget: Number(totalBudgetStr) || 0, eventName } },
    {
      onSuccess: () => {
        toast({ description: "Budget settings saved" });
        refetch();
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "Failed to save budget settings." });
      }
    }
    );
};

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    createItem.mutate(
      { data: { 
        name: newItem.name, 
        category: newItem.category, 
        estimatedCost: Number(newItem.estimatedCost) || 0,
        actualCost: newItem.actualCost ? Number(newItem.actualCost) : undefined
      }},
      {
        onSuccess: () => {
          toast({ description: "Item added" });
          setIsAddItemOpen(false);
          setNewItem({ name: "", category: "Venue", estimatedCost: "", actualCost: "" });
          refetch();
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Failed to add item. Please try again." });
        }
      }
  );
  };

  const handleDeleteItem = (id: number) => {
    deleteItem.mutate(
      { id },
      { onSuccess: () => refetch() }
    );
  };

  const totalEstimated = budget?.items.reduce((sum, item) => sum + item.estimatedCost, 0) || 0;
  const totalActual = budget?.items.reduce((sum, item) => sum + (item.actualCost || 0), 0) || 0;
  const budgetLimit = budget?.totalBudget || 0;
  const progressPercent = budgetLimit > 0 ? Math.min(100, Math.round((totalActual / budgetLimit) * 100)) : 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <Wallet className="h-8 w-8 text-primary" />
          <h1 className="font-serif text-3xl font-bold text-foreground">Budget Planner</h1>
        </div>

        {budgetLoading ? (
          <Skeleton className="h-32 w-full mb-8" />
        ) : (
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="md:col-span-2 border-primary/20 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Spent vs Budget</p>
                    <div className="text-3xl font-serif font-bold text-foreground">
                      ${totalActual.toLocaleString()} <span className="text-lg text-muted-foreground font-sans font-normal">/ ${budgetLimit.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Remaining</p>
                    <div className={`text-xl font-bold ${budgetLimit - totalActual < 0 ? 'text-destructive' : 'text-primary'}`}>
                      ${(budgetLimit - totalActual).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="h-4 w-full bg-background rounded-full overflow-hidden border">
                  <div 
                    className={`h-full transition-all duration-500 ${progressPercent > 90 ? 'bg-destructive' : 'bg-primary'}`} 
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Budget Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Total Budget ($)</Label>
                  <Input 
                    type="number" 
                    value={totalBudgetStr} 
                    onChange={e => setTotalBudgetStr(e.target.value)} 
                    onBlur={handleUpdateBudgetSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Event Name</Label>
                  <Input 
                    value={eventName} 
                    onChange={e => setEventName(e.target.value)}
                    onBlur={handleUpdateBudgetSettings}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-serif font-bold">Line Items</h2>
          <Dialog open={isAddItemOpen} onOpenChange={(open) => { setIsAddItemOpen(open); if (!open) setNewItem({ name: "", category: "Venue", estimatedCost: "", actualCost: "" }); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Budget Item</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddItem} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <Input required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="e.g. DJ Services" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={newItem.category} onValueChange={v => setNewItem({...newItem, category: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estimated Cost</Label>
                    <Input type="number" required value={newItem.estimatedCost} onChange={e => setNewItem({...newItem, estimatedCost: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Actual Cost (Optional)</Label>
                    <Input type="number" value={newItem.actualCost} onChange={e => setNewItem({...newItem, actualCost: e.target.value})} />
                  </div>
                </div>
                <Button type="submit" className="w-full">Save Item</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Estimated</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budget?.items.map((item) => {
                const diff = (item.actualCost || 0) - item.estimatedCost;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-right text-muted-foreground">${item.estimatedCost.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">${(item.actualCost || 0).toLocaleString()}</TableCell>
                    <TableCell className={`text-right ${diff > 0 ? 'text-destructive' : diff < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteItem(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {(!budget?.items || budget.items.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No items added yet. Click "Add Item" to start budgeting.
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right">${totalEstimated.toLocaleString()}</TableCell>
                <TableCell className="text-right">${totalActual.toLocaleString()}</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>
    </Layout>
  );
}
