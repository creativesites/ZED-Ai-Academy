"use server";

import { createClient } from "@/lib/supabase/server";

export async function submitContactForm(formData: {
  name: string;
  email: string;
  subject?: string;
  message: string;
}) {
  const supabase = createClient();

  const { error } = await supabase
    .from("contact_entries")
    .insert({
      name: formData.name,
      email: formData.email,
      subject: formData.subject,
      message: formData.message,
    });

  if (error) {
    console.error("Error submitting contact form:", error);
    throw new Error("Failed to send message. Please try again later.");
  }

  return { success: true };
}

