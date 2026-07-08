import {
  Shield,
  ShieldCheck,
  Lock,
  Info,
  CheckCircle2
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROLE_DEFINITIONS = [
  {
    role: "schooladmin",
    label: "School Administrator",
    description: "Full access to all school modules, settings, and user management.",
    capabilities: ["Manage Users", "School Settings", "Financial Oversight", "Full Academic Access"]
  },
  {
    role: "teacher",
    label: "Teacher",
    description: "Access to classroom management, attendance, and exam marks entry.",
    capabilities: ["Mark Attendance", "Enter Scores", "View Student Profiles", "Class Timetable"]
  },
  {
    role: "finance",
    label: "Finance Officer",
    description: "Manage school fees, accounting, and payroll.",
    capabilities: ["Collect Payments", "Generate Invoices", "Accounting Reports", "Payroll Management"]
  },
  {
    role: "transport",
    label: "Transport Officer",
    description: "Manage school fleet, routes, and transport assignments.",
    capabilities: ["Manage Routes", "Vehicle Maintenance", "Fuel Vouchers", "Transport Reports"]
  },
  {
    role: "librarian",
    label: "Librarian",
    description: "Manage school library resources and student loans.",
    capabilities: ["Catalog Books", "Track Loans", "Library Inventory"]
  }
];

export function RolesPermissionsTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>System Roles & Permissions</CardTitle>
          </div>
          <CardDescription>
            Overview of available system roles and their associated access levels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[200px]">Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Key Capabilities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROLE_DEFINITIONS.map((def) => (
                  <TableRow key={def.role}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-sm">{def.label}</span>
                        <code className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded w-fit">{def.role}</code>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {def.description}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {def.capabilities.map((cap) => (
                          <Badge key={cap} variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                            {cap}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-100 flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold">Role-Based Access Control (RBAC)</p>
              <p className="mt-1">
                Permissions are assigned to roles, not individual users. To grant a user new permissions,
                update their role in the <strong>Users</strong> tab. Custom roles and granular permission
                overrides are currently managed by platform administrators.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4" /> Data Isolation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            All roles are strictly scoped to this school. Users cannot access data from other schools
            regardless of their assigned role.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Audit Enforcement
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            All actions performed by any role are captured in the <strong>Audit Logs</strong>.
            Sensitive operations like financial changes require explicit permissions.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
