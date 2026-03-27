import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, Info, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { communicationHubService, SupportNotification } from "@/services/communicationHubService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NotificationIcon = ({ type }: { type: SupportNotification["notification_type"] }) => {
  switch (type) {
    case "ticket_created":
      return <Info className="h-4 w-4 text-blue-500" />;
    case "ticket_assigned":
      return <Info className="h-4 w-4 text-purple-500" />;
    case "ticket_reply":
      return <Bell className="h-4 w-4 text-orange-500" />;
    case "ticket_resolved":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "system_alert":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "error_report":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
};

export const SupportNotificationPanel = () => {
  const queryClient = useQueryClient();
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["support-notifications"],
    queryFn: communicationHubService.getSupportNotifications,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => communicationHubService.markSupportNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => communicationHubService.markAllSupportNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-notifications"] });
      toast.success("All notifications marked as read");
    },
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <h4 className="text-sm font-semibold">Support Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-primary"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {isLoading ? (
            <div className="flex h-full items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-20" />
              <p className="px-4 text-xs font-medium">No recent support notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "relative flex cursor-pointer gap-3 p-4 transition-colors hover:bg-muted/50",
                    !notification.is_read && "bg-primary/5"
                  )}
                  onClick={() => !notification.is_read && markReadMutation.mutate(notification.id)}
                >
                  <div className="mt-0.5 shrink-0">
                    <NotificationIcon type={notification.notification_type} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-xs font-semibold leading-none", !notification.is_read && "text-primary")}>
                        {notification.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {new Date(notification.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      {notification.message}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full text-xs font-normal text-muted-foreground" asChild>
            <a href="/communications">Open Support Center</a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
