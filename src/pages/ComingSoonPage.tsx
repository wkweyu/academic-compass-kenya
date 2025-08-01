import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ComingSoonPage = ({ title }: { title: string }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-8 text-center text-muted-foreground">
          This module is coming soon.
        </div>
      </CardContent>
    </Card>
  );
};

export default ComingSoonPage;
