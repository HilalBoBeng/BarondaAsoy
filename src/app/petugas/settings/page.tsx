
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, KeyRound, User, Mail, Shield, Phone, MapPin, Star, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Staff } from "@/lib/types";

export default function PetugasSettingsPage() {
    const [staffInfo, setStaffInfo] = useState<Staff | null>(null);
    const [isAccessCodeVisible, setIsAccessCodeVisible] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        const fullStaffInfo = JSON.parse(localStorage.getItem('fullStaffInfo') || '{}');
        setStaffInfo({ ...info, ...fullStaffInfo });
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('userRole');
        localStorage.removeItem('staffInfo');
        localStorage.removeItem('fullStaffInfo');
        router.push('/');
    };

    if (!staffInfo) {
        return <div>Memuat...</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profil Saya</CardTitle>
                <CardDescription>
                    Kelola informasi dan keamanan akun petugas Anda.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={undefined} />
                        <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{staffInfo.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="text-xl font-bold">{staffInfo.name}</h2>
                        <p className="text-sm text-muted-foreground">{staffInfo.email}</p>
                    </div>
                </div>

                <div className="space-y-4">
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
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <span>Peran: Petugas</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                             <CardTitle className="text-base">Keamanan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded-lg">
                                <div>
                                    <p className="text-sm font-medium">Kode Akses</p>
                                    <p className="text-xs text-muted-foreground">Gunakan kode ini untuk masuk.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                   <span className="font-mono text-sm tracking-wider">{isAccessCodeVisible ? staffInfo.accessCode : '••••••••'}</span>
                                   <Button variant="ghost" size="icon" onClick={() => setIsAccessCodeVisible(!isAccessCodeVisible)}>
                                        {isAccessCodeVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                   </Button>
                                </div>
                             </div>
                             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded-lg">
                                <p className="text-sm font-medium">Keluar dari Akun</p>
                                 <Button variant="destructive" onClick={handleLogout}>
                                    <LogOut className="mr-2 h-4 w-4" /> Keluar
                                </Button>
                             </div>
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
        </Card>
    );
}
