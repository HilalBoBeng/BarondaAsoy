
"use client";

import { useState, useEffect, useRef } from 'react';
import { db, app } from '@/lib/firebase/client';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Copy, Check, FileCheck } from "lucide-react";
import { Progress } from '@/components/ui/progress';

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [appDownloadLink, setAppDownloadLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const settingsRef = doc(db, 'app_settings', 'config');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
          setAppDownloadLink(docSnap.data().appDownloadLink || '');
        }
      } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Tidak dapat memuat pengaturan.' });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [toast]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.name.endsWith('.apk')) {
        setSelectedFile(file);
      } else {
        toast({ variant: 'destructive', title: 'File Tidak Valid', description: 'Silakan pilih file dengan format .apk' });
        setSelectedFile(null);
      }
    }
  };
  
  const handleApkUpload = async () => {
    if (!selectedFile) {
        toast({ variant: 'destructive', title: 'Tidak Ada File', description: 'Pilih file APK terlebih dahulu.' });
        return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    const storage = getStorage(app);
    const storageRef = ref(storage, `apk/baronda-app.apk`);
    const uploadTask = uploadBytesResumable(storageRef, selectedFile);
    
    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
        },
        (error) => {
            setIsUploading(false);
            toast({ variant: 'destructive', title: 'Gagal Mengunggah', description: `Terjadi kesalahan: ${error.message}` });
        },
        async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const settingsRef = doc(db, 'app_settings', 'config');
            try {
                // Try to update first, if it fails because it doesn't exist, set it.
                await updateDoc(settingsRef, { appDownloadLink: downloadURL });
            } catch (error) {
                 if ((error as any).code === 'not-found') {
                    await setDoc(settingsRef, { appDownloadLink: downloadURL });
                 } else {
                    toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: 'Gagal menyimpan tautan unduhan.' });
                 }
            } finally {
                 setAppDownloadLink(downloadURL);
                 toast({ title: 'Berhasil', description: 'File APK berhasil diunggah dan tautan telah diperbarui.' });
                 setIsUploading(false);
                 setSelectedFile(null);
                 if(fileInputRef.current) fileInputRef.current.value = "";
            }
        }
    );
  }
  
  const handleCopy = () => {
    navigator.clipboard.writeText(appDownloadLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengaturan Aplikasi</CardTitle>
        <CardDescription>
          Kelola file APK aplikasi yang dapat diunduh oleh pengguna.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
            <label className="text-sm font-medium">Tautan Unduh APK</label>
            <div className="flex items-center gap-2">
                <Input
                    readOnly
                    value={loading ? "Memuat..." : (appDownloadLink || 'Belum ada file APK yang diunggah.')}
                    className="bg-muted/50"
                />
                 {appDownloadLink && (
                    <Button variant="outline" size="icon" onClick={handleCopy}>
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        <span className="sr-only">Salin</span>
                    </Button>
                )}
            </div>
        </div>

        <div className="space-y-2">
            <label className="text-sm font-medium">Unggah File APK Baru</label>
            <div className="flex items-center gap-2">
                <Input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".apk"
                    className="flex-grow"
                    disabled={isUploading}
                />
                <Button onClick={handleApkUpload} disabled={!selectedFile || isUploading}>
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Unggah
                </Button>
            </div>
            {selectedFile && !isUploading && <p className="text-xs text-muted-foreground">File dipilih: {selectedFile.name}</p>}
        </div>

        {isUploading && (
            <div className="space-y-2">
                 <Progress value={uploadProgress} className="w-full" />
                 <p className="text-sm text-center text-muted-foreground">Mengunggah... {Math.round(uploadProgress)}%</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
