// src/config/app-config.ts

/**
 * @fileOverview Centralized configuration for the application.
 * This file acts as the single source of truth for customizable text and assets.
 * Changes made in the Super Admin Editor will modify this file.
 */

export const appConfig = {
  appName: "Baronda",
  appTagline: "Kelurahan Kilongan",
  appLogoUrl: "https://iili.io/KJ4aGxp.png",
  copyrightText: "© {year} Baronda by BoBeng - Siskamling Digital Kelurahan Kilongan.",
  menus: {
    admin: {
      dashboard: "Dasbor",
      profile: "Profil Saya",
      reports: "Laporan Masuk",
      announcements: "Pengumuman",
      users: "Manajemen Pengguna",
      schedule: "Jadwal Patroli",
      attendance: "Daftar Hadir",
      dues: "Iuran Warga",
      honor: "Honorarium",
      activityLog: "Log Admin",
      tools: "Lainnya",
      emergencyContacts: "Kontak Darurat",
      notifications: "Notifikasi",
      editor: "Live Editor"
    },
    petugas: {
      dashboard: "Dasbor",
      profile: "Profil Saya",
      reports: "Laporan Warga",
      schedule: "Jadwal Saya",
      patrolLog: "Patroli & Log",
      dues: "Iuran Warga",
      honor: "Honor Saya",
      announcements: "Pengumuman",
      notifications: "Notifikasi",
      tools: "Lainnya",
      emergencyContacts: "Kontak Darurat"
    }
  }
};
