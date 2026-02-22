"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getEventBySlug, type SeatSection } from "@/lib/events";

function CheckoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const slug = searchParams.get("event") ?? "";
  const sectionId = searchParams.get("section") ?? null;
  const qty = Number(searchParams.get("qty") ?? 1);
  
  const event = getEventBySlug(slug);
  
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    billingAddress: "",
    city: "",
    state: "",
    zip: "",
  });
  
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!event) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f0f4fb]">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">Event not found</p>
          <Link href="/" className="mt-3 inline-block text-sm text-blue-600 hover:underline">← Back to events</Link>
        </div>
      </main>
    );
  }

  const selectedSection: SeatSection | undefined = sectionId
    ? event.sections.find((s) => s.id === sectionId)
    : undefined;

  const displaySection = selectedSection ?? {
    label: event.defaultSection,
    price: event.defaultPrice,
    zone: "lower" as const,
  };

  const subtotal = selectedSection
    ? selectedSection.price * qty
    : event.defaultPrice * qty;
  const serviceFee = qty * 12;
  const total = subtotal + serviceFee;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(" ") : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "cardNumber") {
      setFormData((prev) => ({ ...prev, cardNumber: formatCardNumber(value) }));
    } else if (name === "expiry") {
      setFormData((prev) => ({ ...prev, expiry: formatExpiry(value) }));
    } else if (name === "cvv") {
      setFormData((prev) => ({ ...prev, cvv: value.replace(/[^0-9]/g, "").slice(0, 4) }));
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email.includes("@")) newErrors.email = "Valid email required";
    if (!formData.firstName.trim()) newErrors.firstName = "First name required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name required";
    if (formData.phone.replace(/\D/g, "").length < 10) newErrors.phone = "Valid phone required";
    if (formData.cardNumber.replace(/\s/g, "").length < 15) newErrors.cardNumber = "Valid card number required";
    if (!/^\d{2}\/\d{2}$/.test(formData.expiry)) newErrors.expiry = "MM/YY format required";
    if (formData.cvv.length < 3) newErrors.cvv = "Valid CVV required";
    if (!formData.billingAddress.trim()) newErrors.billingAddress = "Address required";
    if (!formData.city.trim()) newErrors.city = "City required";
    if (!formData.state.trim()) newErrors.state = "State required";
    if (formData.zip.length < 5) newErrors.zip = "Valid ZIP required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setProcessing(true);
    
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    setProcessing(false);
    setCompleted(true);
  };

  if (completed) {
    return (
      <main className="min-h-dvh bg-[#f0f4fb]">
        <header className="sticky top-0 z-40 border-b border-blue-100 bg-white shadow-sm">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm font-bold text-gray-900">Order Confirmed</p>
          </div>
        </header>
        
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Thank You!</h1>
            <p className="mt-2 text-gray-600">Your order has been confirmed.</p>
            
            <div className="mt-6 rounded-xl bg-gray-50 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">Order Details</p>
              <p className="mt-2 font-semibold text-gray-900">{event.name}</p>
              <p className="text-sm text-gray-600">{event.date} · {event.time}</p>
              <p className="text-sm text-gray-600">{event.venue}</p>
              <div className="mt-3 border-t border-gray-200 pt-3">
                <p className="text-sm text-gray-600">{qty}× {displaySection.label}</p>
                <p className="mt-1 text-lg font-bold text-gray-900">Total: ${total.toFixed(2)}</p>
              </div>
            </div>
            
            <p className="mt-6 text-sm text-gray-500">
              A confirmation email has been sent to <strong>{formData.email}</strong>
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Your mobile tickets will be delivered on the day of the event.
            </p>
            
            <Link
              href="/"
              className="mt-8 inline-block rounded-xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f0f4fb] pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-blue-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800 transition"
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="text-sm font-bold text-gray-900">Checkout</p>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Secure checkout
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {/* Order Summary */}
        <div className="mb-6 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-blue-500">Order Summary</p>
          <div className="flex items-start gap-4">
            <div
              className="h-16 w-16 shrink-0 rounded-lg"
              style={{ background: event.imagePlaceholder }}
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 truncate">{event.name}</p>
              <p className="text-sm text-gray-500">{event.date} · {event.time}</p>
              <p className="text-sm text-gray-500">{event.venue}</p>
            </div>
          </div>
          <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{qty}× {displaySection.label}</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Service fee</span>
              <span>${serviceFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 font-bold text-gray-900">
              <span>Total</span>
              <span className="text-blue-700">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-blue-500">Contact Information</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className={`w-full rounded-xl border ${errors.email ? "border-red-300 bg-red-50" : "border-gray-200"} px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                  className={`w-full rounded-xl border ${errors.firstName ? "border-red-300 bg-red-50" : "border-gray-200"} px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                />
                {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  className={`w-full rounded-xl border ${errors.lastName ? "border-red-300 bg-red-50" : "border-gray-200"} px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                />
                {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(555) 123-4567"
                className={`w-full rounded-xl border ${errors.phone ? "border-red-300 bg-red-50" : "border-gray-200"} px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
              />
              {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-blue-500">Payment Information</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
              <input
                type="text"
                name="cardNumber"
                value={formData.cardNumber}
                onChange={handleCardChange}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                className={`w-full rounded-xl border ${errors.cardNumber ? "border-red-300 bg-red-50" : "border-gray-200"} px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
              />
              {errors.cardNumber && <p className="mt-1 text-xs text-red-500">{errors.cardNumber}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="text"
                  name="expiry"
                  value={formData.expiry}
                  onChange={handleCardChange}
                  placeholder="MM/YY"
                  maxLength={5}
                  className={`w-full rounded-xl border ${errors.expiry ? "border-red-300 bg-red-50" : "border-gray-200"} px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                />
                {errors.expiry && <p className="mt-1 text-xs text-red-500">{errors.expiry}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                <input
                  type="text"
                  name="cvv"
                  value={formData.cvv}
                  onChange={handleCardChange}
                  placeholder="123"
                  maxLength={4}
                  className={`w-full rounded-xl border ${errors.cvv ? "border-red-300 bg-red-50" : "border-gray-200"} px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                />
                {errors.cvv && <p className="mt-1 text-xs text-red-500">{errors.cvv}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Billing Address */}
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-blue-500">Billing Address</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input
                type="text"
                name="billingAddress"
                value={formData.billingAddress}
                onChange={handleChange}
                placeholder="123 Main St"
                className={`w-full rounded-xl border ${errors.billingAddress ? "border-red-300 bg-red-50" : "border-gray-200"} px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
              />
              {errors.billingAddress && <p className="mt-1 text-xs text-red-500">{errors.billingAddress}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="New York"
                  className={`w-full rounded-xl border ${errors.city ? "border-red-300 bg-red-50" : "border-gray-200"} px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                />
                {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className={`w-full rounded-xl border ${errors.state ? "border-red-300 bg-red-50" : "border-gray-200"} px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                >
                  <option value="">Select</option>
                  <option value="AL">Alabama</option>
                  <option value="AK">Alaska</option>
                  <option value="AZ">Arizona</option>
                  <option value="AR">Arkansas</option>
                  <option value="CA">California</option>
                  <option value="CO">Colorado</option>
                  <option value="CT">Connecticut</option>
                  <option value="DE">Delaware</option>
                  <option value="FL">Florida</option>
                  <option value="GA">Georgia</option>
                  <option value="HI">Hawaii</option>
                  <option value="ID">Idaho</option>
                  <option value="IL">Illinois</option>
                  <option value="IN">Indiana</option>
                  <option value="IA">Iowa</option>
                  <option value="KS">Kansas</option>
                  <option value="KY">Kentucky</option>
                  <option value="LA">Louisiana</option>
                  <option value="ME">Maine</option>
                  <option value="MD">Maryland</option>
                  <option value="MA">Massachusetts</option>
                  <option value="MI">Michigan</option>
                  <option value="MN">Minnesota</option>
                  <option value="MS">Mississippi</option>
                  <option value="MO">Missouri</option>
                  <option value="MT">Montana</option>
                  <option value="NE">Nebraska</option>
                  <option value="NV">Nevada</option>
                  <option value="NH">New Hampshire</option>
                  <option value="NJ">New Jersey</option>
                  <option value="NM">New Mexico</option>
                  <option value="NY">New York</option>
                  <option value="NC">North Carolina</option>
                  <option value="ND">North Dakota</option>
                  <option value="OH">Ohio</option>
                  <option value="OK">Oklahoma</option>
                  <option value="OR">Oregon</option>
                  <option value="PA">Pennsylvania</option>
                  <option value="RI">Rhode Island</option>
                  <option value="SC">South Carolina</option>
                  <option value="SD">South Dakota</option>
                  <option value="TN">Tennessee</option>
                  <option value="TX">Texas</option>
                  <option value="UT">Utah</option>
                  <option value="VT">Vermont</option>
                  <option value="VA">Virginia</option>
                  <option value="WA">Washington</option>
                  <option value="WV">West Virginia</option>
                  <option value="WI">Wisconsin</option>
                  <option value="WY">Wyoming</option>
                  <option value="DC">Washington D.C.</option>
                </select>
                {errors.state && <p className="mt-1 text-xs text-red-500">{errors.state}</p>}
              </div>
            </div>
            
            <div className="w-1/2">
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
              <input
                type="text"
                name="zip"
                value={formData.zip}
                onChange={handleChange}
                placeholder="10001"
                maxLength={10}
                className={`w-full rounded-xl border ${errors.zip ? "border-red-300 bg-red-50" : "border-gray-200"} px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
              />
              {errors.zip && <p className="mt-1 text-xs text-red-500">{errors.zip}</p>}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={processing}
          className={`w-full rounded-xl py-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            processing
              ? "bg-gray-400 text-white cursor-not-allowed"
              : "bg-[#026cdf] text-white hover:bg-[#0258b8] active:bg-[#014fa6]"
          }`}
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : (
            `Complete Purchase — $${total.toFixed(2)}`
          )}
        </button>
        
        <p className="mt-4 text-center text-xs text-gray-400">
          By completing this purchase, you agree to our Terms of Service and Privacy Policy.
        </p>
      </form>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh bg-[#f0f4fb]">
        <div className="h-14 bg-white border-b border-blue-100" />
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="h-40 rounded-2xl bg-gray-200 animate-pulse mb-6" />
          <div className="h-60 rounded-2xl bg-gray-200 animate-pulse mb-6" />
          <div className="h-40 rounded-2xl bg-gray-200 animate-pulse" />
        </div>
      </div>
    }>
      <CheckoutClient />
    </Suspense>
  );
}
