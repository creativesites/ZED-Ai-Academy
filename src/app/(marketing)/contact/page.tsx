"use client";

import { useState, useTransition } from "react";
import Layout from "@/components/layout/Layout";
import Link from "next/link";
import { Mail, Phone, MapPin, Send, Loader2, CheckCircle2, MessageCircle, X as XIcon, Briefcase, Camera } from "lucide-react";
import { submitContactForm } from "@/actions/contact";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      subject: formData.get("subject") as string,
      message: formData.get("message") as string,
    };

    startTransition(async () => {
      try {
        await submitContactForm(data);
        setSuccess(true);
        toast.success("Message sent successfully!");
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        toast.error("Failed to send message.");
      }
    });
  }

  return (
    <Layout headerStyle={2} footerStyle={1} breadcrumbTitle="Contact Us">
      <section className="contact-page py-24">
        <div className="container">
          <div className="row">
            {/* Left — Intro */}
            <div className="col-xl-6 lg:mb-20">
              <div className="contact-page__top-content pr-12">
                <div className="sec-title mb-10">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#fff2e9] text-[#fd5523] text-xs font-black uppercase tracking-widest mb-6">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Get in touch
                  </div>
                  <h2 className="text-5xl font-extrabold text-[#062e39] tracking-tight leading-[1.1] mb-6">
                    Have a question? <br />
                    We&apos;re here to <span className="text-[#fd5523]">help you.</span>
                  </h2>
                  <p className="text-xl text-slate-500 leading-relaxed max-w-lg">
                    Whether you have a question about a course, need help choosing the right plan
                    for your team, or just want to say hello — our team is ready to help.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-12">
                  <div className="flex items-start gap-4">
                     <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0">
                        <MapPin className="h-6 w-6 text-[#fd5523]" />
                     </div>
                     <div>
                        <h4 className="font-bold text-[#062e39]">Location</h4>
                        <p className="text-sm text-slate-500 mt-1">Lusaka, Zambia 🇿🇲<br/>East Park Office Suite</p>
                     </div>
                  </div>
                  <div className="flex items-start gap-4">
                     <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0">
                        <Phone className="h-6 w-6 text-[#fd5523]" />
                     </div>
                     <div>
                        <h4 className="font-bold text-[#062e39]">Phone</h4>
                        <p className="text-sm text-slate-500 mt-1">0979 046 745<br/>WhatsApp welcome</p>
                     </div>
                  </div>
                </div>

                <div className="flex gap-4">
                   <Link href="#" className="h-12 w-12 rounded-2xl bg-[#062e39] text-white flex items-center justify-center hover:bg-[#fd5523] transition-all">
                      <XIcon className="h-5 w-5" />
                   </Link>
                   <Link href="#" className="h-12 w-12 rounded-2xl bg-[#062e39] text-white flex items-center justify-center hover:bg-[#fd5523] transition-all">
                      <Briefcase className="h-5 w-5" />
                   </Link>
                   <Link href="#" className="h-12 w-12 rounded-2xl bg-[#062e39] text-white flex items-center justify-center hover:bg-[#fd5523] transition-all">
                      <Camera className="h-5 w-5" />
                   </Link>
                </div>
              </div>
            </div>

            {/* Right — Form */}
            <div className="col-xl-6">
              <div className="bg-white rounded-[3rem] p-10 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#fd5523] to-[#fd8d69]" />
                
                {success ? (
                  <div className="py-20 text-center animate-in zoom-in-95 duration-500">
                     <div className="h-20 w-20 rounded-[2.5rem] bg-green-50 flex items-center justify-center mx-auto mb-8">
                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                     </div>
                     <h3 className="text-3xl font-bold text-[#062e39] mb-4">Message Sent!</h3>
                     <p className="text-slate-500 max-w-xs mx-auto leading-relaxed mb-10">
                        Thanks for reaching out. A member of our team will get back to you within 24 hours.
                     </p>
                     <Button 
                      onClick={() => setSuccess(false)}
                      className="px-10 py-7 rounded-full bg-[#062e39] text-white font-bold"
                     >
                        Send Another Message
                     </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Full Name</label>
                        <input name="name" placeholder="John Doe" required className="w-full h-14 rounded-2xl border-2 border-slate-50 bg-slate-50 px-6 text-sm focus:border-[#fd5523]/20 focus:bg-white focus:outline-none transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Email Address</label>
                        <input type="email" name="email" placeholder="john@example.com" required className="w-full h-14 rounded-2xl border-2 border-slate-50 bg-slate-50 px-6 text-sm focus:border-[#fd5523]/20 focus:bg-white focus:outline-none transition-all" />
                      </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Subject</label>
                        <select name="subject" className="w-full h-14 rounded-2xl border-2 border-slate-50 bg-slate-50 px-6 text-sm focus:border-[#fd5523]/20 focus:bg-white focus:outline-none transition-all appearance-none cursor-pointer">
                           <option value="Course Enquiry">Course Enquiry</option>
                           <option value="Team Plan">Team Plan</option>
                           <option value="Technical Support">Technical Support</option>
                           <option value="Billing">Billing</option>
                           <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Message</label>
                        <textarea name="message" placeholder="How can we help?" rows={5} required className="w-full rounded-3xl border-2 border-slate-50 bg-slate-50 p-6 text-sm leading-relaxed focus:border-[#fd5523]/20 focus:bg-white focus:outline-none transition-all resize-none" />
                    </div>

                    <Button
                      type="submit"
                      disabled={pending}
                      className="w-full py-8 rounded-full bg-[#fd5523] text-white font-extrabold text-lg shadow-2xl shadow-[#fd5523]/20 hover:bg-[#ef4a16] transition-all hover:scale-[1.02] active:scale-95 group"
                    >
                      {pending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6 mr-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                      {pending ? "Sending..." : "Send Message"}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="google-map-one px-4 pb-24">
        <div className="container overflow-hidden rounded-[3rem] border-8 border-white shadow-2xl">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d61534.11888524637!2d28.2540963!3d-15.4166415!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x19408b03bff9c72f%3A0x9783d27a3093f05d!2sLusaka%2C%20Zambia!5e0!3m2!1sen!2szm!4v1714000000000"
            className="w-full h-[450px] grayscale"
            allowFullScreen={true}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
    </Layout>
  );
}
