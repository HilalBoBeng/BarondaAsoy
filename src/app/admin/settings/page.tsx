
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link as LinkIcon, Copy } from 'lucide-react';
import { nanoid } from 'nanoid';

const shortLinkSchema = z.object({
  longUrl: z.string().url("URL tidak valid. Harap masukkan URL lengkap (contoh: https://example.com)."),
});

type ShortLinkFormValues = z.infer<typeof shortLinkSchema>;

export default function AdminSettingsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<ShortLinkFormValues>({
    resolver: zodResolver(shortLinkSchema),
    defaultValues: {
      longUrl: '',
    },
  });

  const onSubmit = async (values: ShortLinkFormValues) => {
    setIsSubmitting(true);
    setGeneratedLink(null);

    try {
      const shortCode = nanoid(7);
      
      await addDoc(collection(db, 'shortlinks'), {
        slug: shortCode,
        longUrl: values.longUrl,
        createdAt: serverTimestamp(),
      });

      const fullShortUrl = `${window.location.origin}/go/${shortCode}`;
      setGeneratedLink(fullShortUrl);
      
      toast({
        title: 'Berhasil!',
        description: 'Tautan pendek berhasil dibuat.',
      });
      form.reset();

    } catch (error) {
      console.error("Error creating short link:", error);
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal membuat tautan pendek.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Berhasil', description: 'Tautan berhasil disalin ke clipboard.' });
    }).catch(() => {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menyalin tautan.' });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pemendek Tautan (Short Link)</CardTitle>
        <CardDescription>Buat tautan pendek yang mudah dibagikan. Pengguna akan melihat halaman transisi sebelum diarahkan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="longUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL Panjang</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://example.com/url-sangat-panjang" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LinkIcon className="mr-2 h-4 w-4" />
              )}
              Buat Tautan Pendek
            </Button>
          </form>
        </Form>

        {generatedLink && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-medium">Tautan Berhasil Dibuat:</h3>
            <div className="flex items-center gap-2">
              <Input value={generatedLink} readOnly />
              <Button type="button" size="icon" variant="outline" onClick={() => copyToClipboard(generatedLink)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
