// src/app/api/send-email/route.ts
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs'; // Memaksa Node.js runtime, ini adalah kunci utamanya!

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { from, to, subject, html } = body;

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, html' }, { status: 400 });
    }
    
    // Kredensial ditanam langsung di sini, hanya berjalan di server.
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: "bobeng.icu@gmail.com",
          pass: "hrll wccf slpw shmt",
        },
    });

    const mailOptions = {
      from: from || '"Baronda" <bobeng.icu@gmail.com>',
      to: to,
      subject: subject,
      html: html,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: 'Email sent successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('API Send Email Error:', error);
    return NextResponse.json({ error: 'Failed to send email.', details: error.message }, { status: 500 });
  }
}
