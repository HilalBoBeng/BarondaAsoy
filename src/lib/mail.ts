
"use server"; // Memastikan modul ini hanya berjalan di server

import nodemailer from "nodemailer";

// Konfigurasi Nodemailer dengan kredensial yang di-hardcode
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // Gunakan SSL/TLS
  auth: {
    user: "bobeng.icu@gmail.com",
    pass: "hrll wccf slpw shmt", // App Password Gmail
  },
});

/**
 * Mengirim email berisi One-Time Password (OTP).
 * @param to Alamat email penerima.
 * @param otp Kode OTP yang akan dikirim.
 */
export async function sendOtpMail(to: string, otp: string) {
  const mailOptions = {
    from: '"Baronda" <bobeng.icu@gmail.com>',
    to: to,
    subject: "Kode Verifikasi Baronda Anda",
    html: `
        <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
            <h2>Verifikasi Akun Baronda Anda</h2>
            <p>Gunakan kode berikut untuk menyelesaikan proses pendaftaran Anda. Kode ini berlaku selama 5 menit.</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; margin: 20px; padding: 10px; background-color: #f2f2f2; border-radius: 5px;">${otp}</p>
            <p>Jika Anda tidak merasa meminta kode ini, mohon abaikan email ini.</p>
            <hr style="border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 12px; color: #888;">Baronda - Siskamling Digital Kelurahan Kilongan</p>
        </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Gagal mengirim email verifikasi.");
  }
}
