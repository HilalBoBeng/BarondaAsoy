// src/app/api/send-email/route.ts
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Memaksa runtime Node.js, ini adalah kunci utamanya agar nodemailer berfungsi di Vercel/Netlify
export const runtime = 'nodejs'; 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { from, to, subject, html } = body;

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, html' }, { status: 400 });
    }
    
    // Kredensial ditanam langsung di sini untuk memastikan berfungsi di mana saja
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "bobeng.icu@gmail.com",
          pass: "hrll wccf slpw shmt", 
        },
    });

    const mailOptions = {
      from: from || `"Baronda" <bobeng.icu@gmail.com>`,
      to: to,
      subject: subject,
      html: html,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: 'Email sent successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('API Send Email Error:', error);
    // Memberikan pesan error yang lebih spesifik untuk debugging di production
    return NextResponse.json({ 
        error: 'Failed to send email.', 
        details: error.message,
        code: error.code,
        response: error.response,
    }, { status: 500 });
  }
}
