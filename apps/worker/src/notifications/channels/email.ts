import nodemailer from "nodemailer"
export async function sendEmail(msg: { to: string; subject: string; text: string }) {
  const transport = nodemailer.createTransport({ host: "localhost", port: 1025, secure: false })
  await transport.sendMail({ from: "no-reply@camermove.cm", ...msg })
}
