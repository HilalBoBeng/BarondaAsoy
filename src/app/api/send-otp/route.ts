
import { sendOtpMail } from "@/lib/mail";
import { db } from "@/lib/firebase/client"; // <--- Menggunakan Client SDK
import { collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch } from "firebase/firestore";

export const runtime = "nodejs"; // Wajib agar Nodemailer berfungsi

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return Response.json({ error: "Email diperlukan." }, { status: 400 });
    }

    // 1. Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit dari sekarang

    // 2. Hapus OTP lama untuk email ini menggunakan Client SDK
    const otpQuery = query(collection(db, 'otps'), where('email', '==', email));
    const oldOtps = await getDocs(otpQuery);
    const batch = writeBatch(db);
    oldOtps.forEach(doc => batch.delete(doc.ref));
    await batch.commit();


    // 3. Simpan OTP baru di Firestore menggunakan Client SDK
    await addDoc(collection(db, 'otps'),{
      email,
      otp,
      createdAt: serverTimestamp(),
      expiresAt,
      context: 'userRegistration'
    });

    // 4. Kirim email menggunakan Nodemailer
    await sendOtpMail(email, otp);

    return Response.json({ success: true, message: "OTP berhasil dikirim." });
  } catch (error) {
    console.error("DETAIL ERROR:", error);
    // Tambahkan log yang lebih detail untuk diagnosis
    if (error instanceof Error) {
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
    }
    return Response.json({ error: "Gagal mengirim OTP" }, { status: 500 });
  }
}
