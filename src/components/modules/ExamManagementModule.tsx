import { useState } from "react";
import { Plus, Search, Filter, Calendar, Users, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateExamForm } from "@/components/forms/CreateExamForm";
import { Exam, TERM_OPTIONS, EXAM_TYPE_OPTIONS } from "@/types/cbc";
import { examService } from "@/services/examService";
import { useQuery } from "@tanstack/react-query";

export function ExamManagementModule() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exams", { searchTerm, selectedTerm, selectedType }],
    queryFn: () =>
      examService.getExams({
        search: searchTerm,
        term: selectedTerm === "all" ? undefined : parseInt(selectedTerm),
        exam_type: selectedType === "all" ? undefined : selectedType,
      }),
  });

  const filteredExams = exams;

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
    // In real app, refresh exam list
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Exam Management</h2>
          <p className="text-muted-foreground">
            Create and manage exams for all classes and subjects
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Exam
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Exam</DialogTitle>
              <DialogDescription>
                Set up a new exam for students to take
              </DialogDescription>
            </DialogHeader>
            <CreateExamForm onSuccess={handleCreateSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search exams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                {TERM_OPTIONS.map((term) => (
                  <SelectItem key={term.value} value={term.value.toString()}>
                    {term.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {EXAM_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Exam List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredExams.map((exam) => (
          <Card key={exam.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{exam.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    {exam.subject.name} ({exam.subject.code})
                  </CardDescription>
                </div>
                <Badge variant={exam.is_published ? "default" : "outline"}>
                  {exam.is_published ? "Published" : "Draft"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {exam.class_assigned} {exam.stream}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(exam.exam_date).toLocaleDateString()} •{" "}
                  {exam.duration_minutes} min
                </div>

                <div className="flex items-center justify-between">
                  <Badge variant="secondary">
                    Term {exam.term} • {exam.exam_type}
                  </Badge>
                  <span className="text-sm font-medium">
                    {exam.max_marks} marks
                  </span>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    View Scores
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredExams.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No exams found</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              {searchTerm || selectedTerm !== "all" || selectedType !== "all"
                ? "Try adjusting your filters to see more results."
                : "Get started by creating your first exam."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
