
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, KeyRound, User, Mail, Shield } from "lucide-react";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminSettingsPage() {
    const [adminName, setAdminName] = useState("Admin Utama");
    const [adminEmail, setAdminEmail] = useState("admin@baronda.app");
    const router = useRouter();

    useEffect(() => {
        const staffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        if (staffInfo.name) setAdminName(staffInfo.name);
        if (staffInfo.email) setAdminEmail(staffInfo.email);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('userRole');
        localStorage.removeItem('staffInfo');
        router.push('/');
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profil Admin</CardTitle>
                <CardDescription>
                    Kelola informasi dan keamanan akun admin Anda.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={undefined} />
                        <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{adminName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="text-xl font-bold">{adminName}</h2>
                        <p className="text-sm text-muted-foreground">{adminEmail}</p>
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
                                <span>{adminName}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{adminEmail}</span>
                            </div>
                             <div className="flex items-center gap-3">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <span>Peran: Administrator</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                             <CardTitle className="text-base">Keamanan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded-lg">
                                <p className="text-sm font-medium">Ubah Kata Sandi</p>
                                <Button variant="outline" disabled>
                                    <KeyRound className="mr-2 h-4 w-4" /> Ubah
                                </Button>
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
