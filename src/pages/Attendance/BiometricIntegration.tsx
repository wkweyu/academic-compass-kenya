import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock3, Download, Fingerprint, Info, Plus, RefreshCcw, Router, Settings, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { attendanceService } from "@/services/attendanceService";
import { BiometricDevice, BiometricSettings } from "@/types/attendance";

const defaultSettings: BiometricSettings = {
  biometric_enabled: false,
  attendance_mode: "day",
  check_in_cutoff_time: "08:30:00",
  absence_mark_time: "09:00:00",
  check_out_start_time: "15:30:00",
  duplicate_scan_window_seconds: 120,
  minimum_checkout_gap_minutes: 180,
  auto_mark_absent: true,
  sms_enabled: false,
  send_check_in_sms: true,
  send_check_out_sms: true,
  send_absence_sms: true,
  sms_provider_name: "",
  sms_api_url: "",
  sms_api_key: "",
  sms_sender_id: "",
  check_in_template: "Dear Parent, {student_name} checked in at {time}.",
  check_out_template: "Dear Parent, {student_name} checked out at {time}.",
  absence_template: "Dear Parent, {student_name} has been marked absent for {date}.",
};

const defaultDeviceForm = {
  device_name: "",
  device_ip: "",
  device_port: 4370,
  location: "",
  device_type: "general" as BiometricDevice["device_type"],
  external_device_id: "",
  notes: "",
};

const toTimeInput = (value?: string | null) => (value || "00:00:00").slice(0, 5);
const toApiTime = (value: string) => `${value || "00:00"}:00`;

const formatDateTime = (value?: string | null) => {
  if (!value) return "Never";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Never" : parsed.toLocaleString();
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error && "response" in error) {
    const responseData = (error as { response?: { data?: any } }).response?.data;
    if (typeof responseData?.error === "string") return responseData.error;
    if (typeof responseData?.message === "string") return responseData.message;
    if (Array.isArray(responseData)) return responseData.join(", ");
  }
  if (error instanceof Error) return error.message;
  return fallback;
};

export function BiometricIntegration() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<BiometricSettings>(defaultSettings);
  const [deviceForm, setDeviceForm] = useState(defaultDeviceForm);
  const [testingDeviceId, setTestingDeviceId] = useState<number | null>(null);

  const { data: biometricSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["biometric-settings"],
    queryFn: () => attendanceService.getBiometricSettings(),
  });

  const { data: devices = [], isLoading: devicesLoading } = useQuery({
    queryKey: ["biometric-devices"],
    queryFn: () => attendanceService.getBiometricDevices(),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["biometric-logs"],
    queryFn: () => attendanceService.getBiometricLogs(20),
  });

  const { data: report } = useQuery({
    queryKey: ["biometric-report-summary"],
    queryFn: () => attendanceService.getBiometricReports(),
  });

  useEffect(() => {
    if (biometricSettings) {
      setSettings(biometricSettings);
    }
  }, [biometricSettings]);

  const logs = logsData?.logs || [];
  const smsLogs = logsData?.sms_logs || [];
  const backendWarnings = settings.onboarding_warnings || [];

  const onboardingSteps = useMemo(() => {
    if (settings.attendance_mode === "boarding") {
      return [
        "Create at least one arrival device at the main gate or reporting desk. Use a general device if the same terminal will handle permission exits.",
        "Set the check-in cutoff to the daily morning reporting time for boarders who leave campus during the term.",
        "Use check-out or general devices for exeats and mid-term permissions. End-of-term departures can be captured as checkout events on the departure date.",
        "If you need full dorm-residency tracking from beginning to end of term, keep this biometric module for gate attendance and maintain separate boarding movement controls until residency tracking is added.",
      ];
    }
    if (settings.attendance_mode === "hybrid") {
      return [
        "Register separate gate devices for day scholars and for boarding exits where possible.",
        "Use the same attendance rules for morning reporting, then rely on checkout devices for exeats and afternoon day-scholar departures.",
        "Keep absence auto-marking enabled only after confirming both day and boarding reporting windows are correct.",
        "Pilot with one class or stream before enabling school-wide biometric processing.",
      ];
    }
    return [
      "Register at least one check-in device at the school entry point and one check-out device at the exit point if students leave through a controlled gate.",
      "Set the morning cutoff and absence mark times to match official reporting policy.",
      "Test each device from this page before enabling biometric integration for live attendance.",
      "Once devices are online, save settings, then run one supervised scan per gate to confirm logs and parent messaging.",
    ];
  }, [settings.attendance_mode]);

  const smsGuidance = useMemo(() => {
    if (settings.sms_provider_scope === "school") {
      return "This school is using its own SMS credentials. Messages are billed and controlled by the school account.";
    }
    if (settings.sms_provider_scope === "system") {
      return "This school is using the platform default SMS account. This is useful for plug-and-play rollout in a multi-tenant setup.";
    }
    return "No SMS provider is configured yet. The system will still log SMS events as skipped until either school-specific credentials or a platform default provider is available.";
  }, [settings.sms_provider_scope]);

  const validationNotes = useMemo(() => {
    const notes: string[] = [];
    if (devices.length === 0) {
      notes.push("No devices have been registered yet.");
    }
    if (settings.sms_enabled && !settings.sms_ready) {
      notes.push("SMS is enabled but there is no active school or platform SMS provider configured.");
    }
    if (settings.attendance_mode === "boarding") {
      notes.push("Boarding mode currently uses biometric gate events for reporting and exeat control, not full dorm residency tracking.");
    }
    return notes;
  }, [devices.length, settings.attendance_mode, settings.sms_enabled, settings.sms_ready]);

  const saveSettingsMutation = useMutation({
    mutationFn: (payload: BiometricSettings) => attendanceService.updateBiometricSettings(payload),
    onSuccess: (saved) => {
      setSettings(saved);
      queryClient.invalidateQueries({ queryKey: ["biometric-settings"] });
      toast.success("Biometric attendance settings saved");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to save biometric settings")),
  });

  const createDeviceMutation = useMutation({
    mutationFn: () => attendanceService.createBiometricDevice(deviceForm),
    onSuccess: () => {
      setDeviceForm(defaultDeviceForm);
      queryClient.invalidateQueries({ queryKey: ["biometric-devices"] });
      toast.success("Biometric device added");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to add biometric device")),
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: (deviceId: number) => attendanceService.deleteBiometricDevice(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["biometric-devices"] });
      toast.success("Device removed");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to delete device")),
  });

  const markAbsentMutation = useMutation({
    mutationFn: () => attendanceService.markAbsentStudents(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["biometric-report-summary"] });
      queryClient.invalidateQueries({ queryKey: ["biometric-logs"] });
      toast.success(`Marked ${data.created_count} students absent`);
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to auto-mark absences")),
  });

  const summaryCards = useMemo(() => {
    const summary = report?.summary;
    return [
      { label: "Present Records", value: summary?.present ?? 0, icon: CheckCircle2 },
      { label: "Late Arrivals", value: summary?.late ?? 0, icon: Clock3 },
      { label: "Absent Records", value: summary?.absent ?? 0, icon: AlertCircle },
      { label: "Missing Check-out", value: summary?.missing_checkout ?? 0, icon: RefreshCcw },
    ];
  }, [report]);

  const handleSaveSettings = () => {
    if (settings.sms_enabled && !settings.sms_ready && !settings.sms_api_url.trim()) {
      toast.error("SMS is enabled but no school SMS provider is configured and no platform default provider is available.");
      return;
    }
    saveSettingsMutation.mutate({
      ...settings,
      check_in_cutoff_time: toApiTime(toTimeInput(settings.check_in_cutoff_time)),
      absence_mark_time: toApiTime(toTimeInput(settings.absence_mark_time)),
      check_out_start_time: toApiTime(toTimeInput(settings.check_out_start_time)),
    });
  };

  const handleTestConnection = async (device?: BiometricDevice) => {
    try {
      if (!device && !deviceForm.device_ip.trim()) {
        toast.error("Enter a device IP address before testing the draft connection.");
        return;
      }
      setTestingDeviceId(device?.id || 0);
      const result = await attendanceService.testBiometricDevice(
        device
          ? { deviceId: device.id }
          : { device_ip: deviceForm.device_ip, device_port: Number(deviceForm.device_port || 4370) }
      );
      queryClient.invalidateQueries({ queryKey: ["biometric-devices"] });
      toast.success(result.message);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Connection test failed"));
    } finally {
      setTestingDeviceId(null);
    }
  };

  const handleExportCsv = async () => {
    try {
      const blob = await attendanceService.exportBiometricAttendance();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `attendance-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Attendance CSV downloaded");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to export attendance CSV"));
    }
  };

  const handleAddDevice = () => {
    if (!deviceForm.device_name.trim() || !deviceForm.device_ip.trim() || !deviceForm.location.trim()) {
      toast.error("Device name, IP address, and location are required before you can register a device.");
      return;
    }
    createDeviceMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Fingerprint className="h-6 w-6 text-primary" />
            <CardTitle>Biometric Device Settings</CardTitle>
          </div>
          <CardDescription>
            Configure multi-device attendance capture, late and absence rules, and parent SMS notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border border-dashed bg-background/70 p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 text-primary" />
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">Setup Checklist</h4>
                  <p className="text-sm text-muted-foreground">Use this order during onboarding so device rollout stays plug-and-play.</p>
                </div>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  {onboardingSteps.map((step, index) => (
                    <li key={step} className="flex gap-2">
                      <span className="min-w-5 font-medium text-foreground">{index + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-xl border bg-background/80 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{card.label}</p>
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">{card.value}</p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Biometric Integration</Label>
              <p className="text-sm text-muted-foreground">
                Allow biometric devices to mark attendance automatically
              </p>
            </div>
            <Switch
              checked={settings.biometric_enabled}
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, biometric_enabled: checked }))}
              disabled={settingsLoading}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border p-4">
              <div>
                <h4 className="font-medium">Attendance Rules</h4>
                <p className="text-sm text-muted-foreground">Define how scans become check-ins, check-outs, late arrivals, and absences.</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                {settings.attendance_mode === "day" && "Day scholar mode expects daily check-in and optional same-day checkout events."}
                {settings.attendance_mode === "boarding" && "Boarding mode uses daily gate reporting and exeat tracking. Beginning-of-term reporting and end-of-term departure should be captured as scan events on the relevant days."}
                {settings.attendance_mode === "hybrid" && "Hybrid mode combines day scholar morning attendance with boarding exit controls for boarders leaving campus during term."}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="attendance-mode">Attendance Mode</Label>
                  <select
                    id="attendance-mode"
                    title="Attendance mode"
                    aria-label="Attendance mode"
                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={settings.attendance_mode}
                    onChange={(event) => setSettings((prev) => ({ ...prev, attendance_mode: event.target.value as BiometricSettings['attendance_mode'] }))}
                  >
                    <option value="day">Day Scholar</option>
                    <option value="boarding">Boarding</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="cutoff">Check-in Cutoff</Label>
                  <Input id="cutoff" type="time" value={toTimeInput(settings.check_in_cutoff_time)} onChange={(event) => setSettings((prev) => ({ ...prev, check_in_cutoff_time: toApiTime(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="absence-cutoff">Absence Mark Time</Label>
                  <Input id="absence-cutoff" type="time" value={toTimeInput(settings.absence_mark_time)} onChange={(event) => setSettings((prev) => ({ ...prev, absence_mark_time: toApiTime(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="checkout-start">Check-out Start</Label>
                  <Input id="checkout-start" type="time" value={toTimeInput(settings.check_out_start_time)} onChange={(event) => setSettings((prev) => ({ ...prev, check_out_start_time: toApiTime(event.target.value) }))} />
                </div>
                <div>
                  <Label htmlFor="duplicate-window">Duplicate Scan Window (sec)</Label>
                  <Input id="duplicate-window" type="number" value={settings.duplicate_scan_window_seconds} onChange={(event) => setSettings((prev) => ({ ...prev, duplicate_scan_window_seconds: Number(event.target.value || 0) }))} />
                </div>
                <div>
                  <Label htmlFor="checkout-gap">Minimum Check-out Gap (min)</Label>
                  <Input id="checkout-gap" type="number" value={settings.minimum_checkout_gap_minutes} onChange={(event) => setSettings((prev) => ({ ...prev, minimum_checkout_gap_minutes: Number(event.target.value || 0) }))} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Auto-Mark Absence</Label>
                  <p className="text-xs text-muted-foreground">Create absent records automatically after the configured cutoff.</p>
                </div>
                <Switch checked={settings.auto_mark_absent} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, auto_mark_absent: checked }))} />
              </div>
            </div>

            <div className="space-y-4 rounded-xl border p-4">
              <div>
                <h4 className="font-medium">SMS Rules</h4>
                <p className="text-sm text-muted-foreground">Control parent notifications for check-in, check-out, and absence.</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p>{smsGuidance}</p>
                <p className="mt-2">
                  Multi-tenant recommendation: allow each school to bring its own SMS account for billing independence, but keep a platform default provider for fast onboarding or schools that do not want separate contracts.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Enable Attendance SMS</Label>
                  <p className="text-xs text-muted-foreground">Messages are logged even when provider credentials are not configured.</p>
                </div>
                <Switch checked={settings.sms_enabled} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, sms_enabled: checked }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="provider-name">Provider Name</Label>
                  <Input id="provider-name" value={settings.sms_provider_name} onChange={(event) => setSettings((prev) => ({ ...prev, sms_provider_name: event.target.value }))} placeholder="Africa's Talking / Custom API" />
                </div>
                <div>
                  <Label htmlFor="sender-id">Sender ID</Label>
                  <Input id="sender-id" value={settings.sms_sender_id} onChange={(event) => setSettings((prev) => ({ ...prev, sms_sender_id: event.target.value }))} placeholder="SkoolTrack" />
                </div>
              </div>
              <div>
                <Label htmlFor="sms-api-url">SMS API URL</Label>
                <Input id="sms-api-url" value={settings.sms_api_url} onChange={(event) => setSettings((prev) => ({ ...prev, sms_api_url: event.target.value }))} placeholder="https://sms.example.com/send" />
              </div>
              <div>
                <Label htmlFor="sms-api-key">SMS API Key</Label>
                <Input id="sms-api-key" type="password" value={settings.sms_api_key} onChange={(event) => setSettings((prev) => ({ ...prev, sms_api_key: event.target.value }))} placeholder="Bearer token or API key" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="text-sm">Check-in</Label>
                  <Switch checked={settings.send_check_in_sms} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, send_check_in_sms: checked }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="text-sm">Check-out</Label>
                  <Switch checked={settings.send_check_out_sms} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, send_check_out_sms: checked }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="text-sm">Absence</Label>
                  <Switch checked={settings.send_absence_sms} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, send_absence_sms: checked }))} />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="checkin-template">Check-in Template</Label>
                  <Textarea id="checkin-template" value={settings.check_in_template} onChange={(event) => setSettings((prev) => ({ ...prev, check_in_template: event.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="checkout-template">Check-out Template</Label>
                  <Textarea id="checkout-template" value={settings.check_out_template} onChange={(event) => setSettings((prev) => ({ ...prev, check_out_template: event.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="absence-template">Absence Template</Label>
                  <Textarea id="absence-template" value={settings.absence_template} onChange={(event) => setSettings((prev) => ({ ...prev, absence_template: event.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          {backendWarnings.length > 0 ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <h4 className="font-medium">System Warnings</h4>
              <ul className="mt-2 space-y-2 text-blue-900">
                {backendWarnings.map((warning) => (
                  <li key={warning.code} className="flex gap-2">
                    <span className="font-medium uppercase text-[11px] tracking-[0.16em] text-blue-700">{warning.level}</span>
                    <span>{warning.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {validationNotes.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <h4 className="font-medium">Setup Notes</h4>
              <ul className="mt-2 space-y-1 text-amber-800">
                {validationNotes.map((note) => (
                  <li key={note}>- {note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button onClick={() => handleTestConnection()} disabled={testingDeviceId === 0 || !deviceForm.device_ip}>
              <Settings className="mr-2 h-4 w-4" />
              Test Draft Connection
            </Button>
            <Button variant="outline" onClick={handleSaveSettings} disabled={saveSettingsMutation.isPending}>
              Save Configuration
            </Button>
            <Button variant="secondary" onClick={() => markAbsentMutation.mutate()} disabled={markAbsentMutation.isPending || !settings.auto_mark_absent}>
              Auto-Mark Absences
            </Button>
            <Button variant="ghost" onClick={handleExportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2">Connection Status</h4>
            <p className="text-sm text-muted-foreground">
              {devices.length === 0
                ? "No biometric devices configured yet. Add at least one check-in, check-out, or general device."
                : `${devices.filter((device) => device.connection_status === "online").length} of ${devices.length} devices currently report as reachable.`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Device Registry</CardTitle>
              <CardDescription>Register unlimited ZKTeco or networked biometric endpoints by location and direction.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1.8fr]">
            <div className="space-y-4 rounded-xl border p-4">
              <div>
                <h4 className="font-medium">Add Device</h4>
                <p className="text-sm text-muted-foreground">Create check-in, check-out, or general scan devices with school-scoped API keys.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Device Name</Label>
                  <Input value={deviceForm.device_name} onChange={(event) => setDeviceForm((prev) => ({ ...prev, device_name: event.target.value }))} placeholder="Main Gate Scanner" />
                </div>
                <div>
                  <Label>Device IP</Label>
                  <Input value={deviceForm.device_ip} onChange={(event) => setDeviceForm((prev) => ({ ...prev, device_ip: event.target.value }))} placeholder="192.168.1.100" />
                </div>
                <div>
                  <Label>Port</Label>
                  <Input type="number" value={deviceForm.device_port} onChange={(event) => setDeviceForm((prev) => ({ ...prev, device_port: Number(event.target.value || 4370) }))} placeholder="4370" />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={deviceForm.location} onChange={(event) => setDeviceForm((prev) => ({ ...prev, location: event.target.value }))} placeholder="Gate / Dining Hall / Dorm" />
                </div>
                <div>
                  <Label>Device Type</Label>
                  <select title="Device type" aria-label="Device type" className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={deviceForm.device_type} onChange={(event) => setDeviceForm((prev) => ({ ...prev, device_type: event.target.value as BiometricDevice['device_type'] }))}>
                    <option value="check_in">Check In</option>
                    <option value="check_out">Check Out</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label>External Device ID</Label>
                  <Input value={deviceForm.external_device_id} onChange={(event) => setDeviceForm((prev) => ({ ...prev, external_device_id: event.target.value }))} placeholder="Optional physical device identifier" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea value={deviceForm.notes} onChange={(event) => setDeviceForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Any routing or deployment notes" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddDevice} disabled={createDeviceMutation.isPending || !deviceForm.device_name || !deviceForm.device_ip || !deviceForm.location}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Device
                </Button>
                <Button variant="outline" onClick={() => handleTestConnection()} disabled={testingDeviceId === 0 || !deviceForm.device_ip}>
                  <Router className="mr-2 h-4 w-4" />
                  Test
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {devicesLoading ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Loading devices...</div>
              ) : devices.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  No devices registered yet. Start with the main reporting point first, test the connection, then add exit or exeat devices.
                </div>
              ) : (
                devices.map((device) => (
                  <div key={device.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{device.device_name}</h4>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{device.device_type.replace("_", " ")}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{device.connection_status}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{device.location} • {device.device_ip}:{device.device_port}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Last seen: {formatDateTime(device.last_seen_at)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleTestConnection(device)} disabled={testingDeviceId === device.id}>
                          <Router className="mr-2 h-3.5 w-3.5" />
                          Test
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteDeviceMutation.mutate(device.id)} disabled={deleteDeviceMutation.isPending}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Biometric Logs</CardTitle>
            <CardDescription>Raw scan capture and processing results from device traffic.</CardDescription>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="text-sm text-muted-foreground">Loading biometric logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No biometric logs available</div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{log.student_name || log.identifier}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{log.event_type}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{log.processing_status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{log.device_name || "Unknown device"} • {formatDateTime(log.scanned_at)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Attendance SMS Logs</CardTitle>
            <CardDescription>Attendance notifications sent, skipped, or failed for guardians.</CardDescription>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="text-sm text-muted-foreground">Loading SMS logs...</div>
            ) : smsLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No attendance SMS logs available</div>
            ) : (
              <div className="space-y-3">
                {smsLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{log.student_name || log.recipient_phone}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{log.event_type}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{log.delivery_status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{log.recipient_phone} • {formatDateTime(log.sent_at)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
