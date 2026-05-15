import { useState } from "react";
import { useLocation } from "wouter";
import { 
  useListChecklistItems, 
  useCreateChecklistItem, 
  useUpdateChecklistItem, 
  useDeleteChecklistItem,
  useGetCurrentUser 
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Plus, Trash2 } from "lucide-react";

const CATEGORIES = ["Venue", "Catering", "Decor", "Entertainment", "Photography", "Attire", "Invitations", "Sweets", "Misc"];

export default function Checklist() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: items, isLoading: itemsLoading, refetch } = useListChecklistItems({ query: { enabled: !!user } });
  
  const createItem = useCreateChecklistItem();
  const updateItem = useUpdateChecklistItem();
  const deleteItem = useDeleteChecklistItem();

  const [newTask, setNewTask] = useState("");
  const [newCategory, setNewCategory] = useState("Misc");
  const [filter, setFilter] = useState("all"); // all, done, undone

  if (!userLoading && !user) {
    setLocation("/login");
    return null;
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    
    createItem.mutate(
      { data: { task: newTask, category: newCategory } },
      {
        onSuccess: () => {
          setNewTask("");
          refetch();
          toast({ description: "Task added" });
        }
      }
    );
  };

  const handleToggle = (id: number, isDone: boolean) => {
    updateItem.mutate(
      { id, data: { isDone } },
      {
        onSuccess: () => refetch()
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteItem.mutate(
      { id },
      {
        onSuccess: () => {
          refetch();
          toast({ description: "Task deleted" });
        }
      }
    );
  };

  const filteredItems = items?.filter(item => {
    if (filter === "done") return item.isDone;
    if (filter === "undone") return !item.isDone;
    return true;
  });

  // Group by category
  const groupedItems = filteredItems?.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  const progress = items?.length 
    ? Math.round((items.filter(i => i.isDone).length / items.length) * 100) 
    : 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <CheckSquare className="h-8 w-8 text-primary" />
          <h1 className="font-serif text-3xl font-bold text-foreground">Event Checklist</h1>
        </div>

        {/* Progress Bar */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex justify-between mb-2 font-medium">
              <span>Overall Progress</span>
              <span className="text-primary">{progress}%</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500 ease-in-out" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Add new task */}
        <Card className="mb-8">
          <CardContent className="p-4">
            <form onSubmit={handleAdd} className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label>New Task</Label>
                <Input 
                  placeholder="e.g. Book the Dhol players" 
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                />
              </div>
              <div className="w-48 space-y-2">
                <Label>Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={!newTask.trim() || createItem.isPending}>
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 border-b pb-4">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>All Tasks</Button>
          <Button variant={filter === "undone" ? "default" : "outline"} size="sm" onClick={() => setFilter("undone")}>To Do</Button>
          <Button variant={filter === "done" ? "default" : "outline"} size="sm" onClick={() => setFilter("done")}>Completed</Button>
        </div>

        {/* Task List */}
        {itemsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !groupedItems || Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No tasks found. Add some tasks to get started!
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedItems).map(([category, categoryItems]) => (
              <div key={category} className="space-y-3">
                <h3 className="font-medium text-lg text-primary border-b pb-1">{category}</h3>
                <div className="space-y-2">
                  {categoryItems.map(item => (
                    <div 
                      key={item.id} 
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${item.isDone ? 'bg-muted/50 border-muted' : 'bg-card border-border hover:border-primary/30'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={item.isDone} 
                          onCheckedChange={(checked) => handleToggle(item.id, checked as boolean)}
                          className="h-5 w-5"
                        />
                        <span className={item.isDone ? 'line-through text-muted-foreground' : 'font-medium'}>
                          {item.task}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

import { Label } from "@/components/ui/label";