
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { KeyRound, User, Phone, MapPin, Star, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Staff } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { resetStaffAccessCode } from "@/ai/flows/reset-staff-access-code";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

const accessCodeSchema = z.object({
  currentAccessCode: z.string().min(1, "Kode akses saat ini harus diisi."),
});
type AccessCodeFormValues = z.infer<typeof accessCodeSchema>;

export default function PetugasSettingsPage() {
    const [staffInfo, setStaffInfo] = useState<Staff | null>(null);
    const [isAccessCodeVisible, setIsAccessCodeVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const accessCodeForm = useForm<AccessCodeFormValues>({ resolver: zodResolver(accessCodeSchema) });

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        if (info.id) {
            const unsub = onSnapshot(doc(db, "staff", info.id), (docSnap) => {
                if (docSnap.exists()) {
                    setStaffInfo({ id: docSnap.id, ...docSnap.data() } as Staff);
                }
            });
            return () => unsub();
        }
    }, []);
    
    const onAccessCodeSubmit = async (data: AccessCodeFormValues) => {
        if (!staffInfo?.id) return;
        setIsSubmitting(true);
        
        try {
            const result = await resetStaffAccessCode({
                staffId: staffInfo.id,
                currentAccessCode: data.currentAccessCode
            });

            if (result.success) {
                toast({ title: 'Berhasil', description: result.message });
                accessCodeForm.reset();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal', description: error instanceof Error ? error.message : "Gagal mengubah kode akses." });
        } finally {
            setIsSubmitting(false);
        }
    };


    if (!staffInfo) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <div className="space-y-6">
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={undefined} />
                        <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{staffInfo.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="text-xl font-bold">{staffInfo.name}</h2>
                        <p className="text-sm text-muted-foreground">{staffInfo.email}</p>
                        <Badge variant="secondary" className="mt-2">Petugas</Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Informasi Akun</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex items-center gap-3">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{staffInfo.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{staffInfo.phone}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{staffInfo.addressDetail}</span>
                        </div>
                         <div className="flex items-center gap-3">
                            <Star className="h-4 w-4 text-muted-foreground" />
                            <span>{staffInfo.points || 0} Poin</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                               <span className="font-mono text-sm tracking-wider">{isAccessCodeVisible ? staffInfo.accessCode : '••••••••'}</span>
                               <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsAccessCodeVisible(!isAccessCodeVisible)}>
                                    {isAccessCodeVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                               </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                         <CardTitle className="text-base">Ubah Kode Akses</CardTitle>
                         <CardDescription>Jika Anda merasa kode akses Anda tidak aman, Anda dapat meminta yang baru di sini.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Form {...accessCodeForm}>
                            <form onSubmit={accessCodeForm.handleSubmit(onAccessCodeSubmit)} className="space-y-4">
                                <FormField
                                    control={accessCodeForm.control}
                                    name="currentAccessCode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Verifikasi Kode Akses Saat Ini</FormLabel>
                                            <FormControl><Input type="password" {...field} placeholder="Masukkan kode akses Anda" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Kirim Kode Akses Baru ke Email
                                </Button>
                            </form>
                         </Form>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
        </div>
    );
}
