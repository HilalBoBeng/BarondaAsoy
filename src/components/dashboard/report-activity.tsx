"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { triageReport, type TriageReportOutput } from '@/ai/flows/triage-report';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Send, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '../ui/badge';

const reportSchema = z.object({
  reportText: z.string().min(10, 'Please provide a more detailed report.'),
  category: z.enum(['theft', 'vandalism', 'suspicious_person', 'other']),
  location: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

const ThreatLevelBadge = ({ level }: { level: TriageReportOutput['threatLevel'] }) => {
    const config = {
        low: { icon: CheckCircle, variant: 'secondary', className: 'bg-green-100 text-green-800' },
        medium: { icon: AlertTriangle, variant: 'secondary', className: 'bg-yellow-100 text-yellow-800' },
        high: { icon: AlertTriangle, variant: 'destructive', className: '' },
    } as const;
    const { icon: Icon, variant, className } = config[level];
    return <Badge variant={variant} className={`capitalize ${className}`}>
        <Icon className="mr-1 h-3 w-3" />
        {level}
    </Badge>
}

export default function ReportActivity() {
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageReportOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportText: '',
    },
  });

  const handleGetLocation = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationString = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        form.setValue('location', locationString);
        toast({
          title: 'Location Acquired',
          description: `Coordinates: ${locationString}`,
        });
        setIsLocating(false);
      },
      (error) => {
        console.error('Error getting location', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not get location. Please enable location services.',
        });
        setIsLocating(false);
      }
    );
  };

  const onSubmit = async (data: ReportFormValues) => {
    setIsSubmitting(true);
    setTriageResult(null);
    try {
      const result = await triageReport(data);
      setTriageResult(result);
      toast({
        title: 'Report Submitted Successfully',
        description: 'Your report has been received and triaged.',
      });
      form.reset();
    } catch (error) {
      console.error('Triage failed', error);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: 'There was an error submitting your report. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Report Suspicious Activity</CardTitle>
        <CardDescription>
          Your report will be triaged by our AI for immediate assessment.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="reportText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Describe the activity</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., I saw a person looking into car windows on Main St."
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="theft">Theft</SelectItem>
                        <SelectItem value="vandalism">Vandalism</SelectItem>
                        <SelectItem value="suspicious_person">Suspicious Person</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Location (Optional)</FormLabel>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGetLocation}
                    disabled={isLocating}
                    className="w-full"
                  >
                    {isLocating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MapPin className="mr-2 h-4 w-4" />
                    )}
                    Get Current Location
                  </Button>
                </div>
                 {form.watch('location') && <p className="text-sm text-muted-foreground mt-2">📍 {form.watch('location')}</p>}
              </FormItem>
            </div>
            {triageResult && (
                <Card className="bg-secondary/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            AI Triage Result: <ThreatLevelBadge level={triageResult.threatLevel} />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground"><span className='font-semibold text-foreground'>Reason:</span> {triageResult.reason}</p>
                    </CardContent>
                </Card>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Submit Report
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
