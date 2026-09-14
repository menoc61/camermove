import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonCard() {
  return (
    <Card aria-busy="true">
      <CardHeader className="flex flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Separator />
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </CardFooter>
    </Card>
  );
}
