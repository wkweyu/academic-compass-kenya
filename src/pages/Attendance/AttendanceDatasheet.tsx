import { PageHeader } from "@/components/layout/PageHeader.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { api } from "@/api/api";
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
import { Button } from "@/components/ui/button";

export function AttendanceDatasheet() {
  const [data, setData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [streams, setStreams] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStream, setSelectedStream] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    // Fetch classes and streams for the filters
    api.get("/api/classes/").then((res) => setClasses(res.data));
    api.get("/api/streams/").then((res) => setStreams(res.data));
  }, []);

  const fetchDatasheet = () => {
    api
      .get("/api/attendance/datasheet/", {
        params: {
          class_id: selectedClass,
          stream_id: selectedStream,
          start_date: startDate,
          end_date: endDate,
        },
      })
      .then((res) => setData(res.data));
  };

  useEffect(() => {
    fetchDatasheet();
  }, [selectedClass, selectedStream, startDate, endDate]);

  return (
    <div>
      <PageHeader title="Weekly Attendance Datasheet" />
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-4">
            <Select onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={setSelectedStream}>
              <SelectTrigger>
                <SelectValue placeholder="Select Stream" />
              </SelectTrigger>
              <SelectContent>
                {streams.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border p-2 rounded"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border p-2 rounded"
            />
            <Button onClick={fetchDatasheet}>Filter</Button>
          </div>
          {data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  {data.dates.map((date) => (
                    <TableHead key={date}>{date}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>{student.full_name}</TableCell>
                    {student.attendance.map((status, index) => (
                      <TableCell key={index}>{status}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
